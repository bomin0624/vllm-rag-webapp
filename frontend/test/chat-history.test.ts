import assert from 'node:assert/strict';
import test from 'node:test';

import { chatHistoryKey, createChatHistory } from '../src/lib/chat-history.ts';
import type { ChatEntry, ChatSession } from '../src/lib/types/chat.ts';

function chat(id: string): ChatSession {
	return { id, title: id, entries: [], updatedAt: 0 };
}

function append(chatId: string, id: string) {
	const entry: ChatEntry = {
		id,
		query: id,
		response: { answer: id, model: 'test', sources: [] }
	};
	return (chats: ChatSession[]) =>
		chats.map((chat) =>
			chat.id === chatId ? { ...chat, entries: [...chat.entries, entry] } : chat
		);
}

function setup(initial: ChatSession[] = [chat('X')], useLocks = true) {
	let value: string | null = JSON.stringify(initial);
	let writes = 0;
	let failWrites = false;
	let lockQueue = Promise.resolve();
	const lockNames: string[] = [];
	const tabs: {
		target: EventTarget;
		dispatch(key: string | null, newValue: string | null): void;
	}[] = [];
	const events: (() => void)[] = [];
	const locks = {
		request(name: string, callback: () => void) {
			lockNames.push(name);
			const result = lockQueue.then(callback);
			lockQueue = result.catch(() => {});
			return result;
		}
	};

	function createTab() {
		const target = new EventTarget();
		const state = { chats: [] as ChatSession[], error: '', notifications: 0 };
		const storage = {
			getItem: () => value,
			setItem(_key: string, next: string) {
				if (failWrites) throw new Error('QuotaExceededError');
				value = next;
				writes++;
				for (const tab of tabs) {
					if (tab.target !== target) {
						events.push(() => tab.dispatch(chatHistoryKey, next));
					}
				}
			}
		};
		const history = createChatHistory({
			storage,
			events: target,
			locks: useLocks ? locks : undefined,
			onChange(chats, error) {
				state.chats = chats;
				state.error = error;
				state.notifications++;
			}
		});
		const tab = {
			...history,
			state,
			target,
			dispatch(key: string | null, newValue: string | null, storageArea: unknown = storage) {
				target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea }));
			}
		};
		tabs.push(tab);
		return tab;
	}

	return {
		createTab,
		lockNames,
		get writes() {
			return writes;
		},
		get saved(): ChatSession[] {
			return JSON.parse(value ?? '[]');
		},
		set failWrites(fail: boolean) {
			failWrites = fail;
		},
		clear() {
			value = null;
		},
		flushEvents() {
			for (const dispatch of events.splice(0)) dispatch();
		}
	};
}

for (const useLocks of [true, false]) {
	test(`a stale tab preserves another tab's new chat (locks: ${useLocks})`, async () => {
		const browser = setup([chat('X')], useLocks);
		const a = browser.createTab();
		const b = browser.createTab();
		await Promise.all([a.update((chats) => chats), b.update((chats) => chats)]);

		await a.update((chats) => [chat('Y'), ...chats]);
		assert.deepEqual(
			b.state.chats.map((chat) => chat.id),
			['X']
		);
		// B writes before receiving A's storage event.
		await b.update(append('X', 'question'));
		assert.deepEqual(
			browser.saved.map((chat) => chat.id),
			['Y', 'X']
		);
		assert.equal(browser.saved[1].entries[0].id, 'question');

		const writes = browser.writes;
		browser.flushEvents();
		assert.deepEqual(a.state.chats, browser.saved);
		assert.deepEqual(b.state.chats, browser.saved);
		assert.equal(browser.writes, writes, 'storage events must not write back');
	});
}

test('simultaneous updates retain both answers and both new chats', async () => {
	const browser = setup();
	const a = browser.createTab();
	const b = browser.createTab();
	await Promise.all([a.update(append('X', 'a')), b.update(append('X', 'b'))]);
	await Promise.all([
		a.update((chats) => [chat('Y'), ...chats]),
		b.update((chats) => [chat('Z'), ...chats])
	]);
	browser.flushEvents();
	assert.deepEqual(browser.saved.map((chat) => chat.id).sort(), ['X', 'Y', 'Z']);
	assert.deepEqual(
		browser.saved.find((chat) => chat.id === 'X')?.entries.map((entry) => entry.id),
		['a', 'b']
	);
	assert.ok(browser.lockNames.every((name) => name === chatHistoryKey));
	assert.equal(browser.lockNames.length, 4);
	assert.deepEqual(a.state.chats, b.state.chats);
});

test('a late answer cannot restore a chat deleted by another tab', async () => {
	const browser = setup([chat('X'), chat('Y')]);
	const a = browser.createTab();
	const b = browser.createTab();
	await b.update((chats) => chats);
	await a.update((chats) => chats.filter((chat) => chat.id !== 'X'));
	await b.update(append('X', 'late answer'));
	browser.flushEvents();
	assert.deepEqual(browser.saved, [chat('Y')]);
	assert.deepEqual(b.state.chats, [chat('Y')]);
});

test('concurrent initialization creates only one default chat', async () => {
	const browser = setup([]);
	const a = browser.createTab();
	const b = browser.createTab();
	await Promise.all([
		a.update((chats) => (chats.length ? chats : [chat('A')])),
		b.update((chats) => (chats.length ? chats : [chat('B')]))
	]);
	browser.flushEvents();
	assert.equal(browser.saved.length, 1);
	assert.deepEqual(a.state.chats, b.state.chats);
});

test('failed saves retain local changes and merge them with other tabs on retry', async () => {
	const browser = setup();
	const a = browser.createTab();
	const b = browser.createTab();
	browser.failWrites = true;
	await a.update(append('X', 'unsaved'));
	assert.notEqual(a.state.error, '');
	assert.equal(a.state.chats[0].entries.length, 1);
	assert.equal(browser.saved[0].entries.length, 0);

	browser.failWrites = false;
	await b.update((chats) => [chat('Y'), ...chats]);
	browser.flushEvents();
	assert.notEqual(a.state.error, '');
	assert.equal(a.state.chats.find((chat) => chat.id === 'X')?.entries.length, 1);
	await a.update(append('X', 'retry'));
	assert.equal(a.state.error, '');
	assert.deepEqual(
		browser.saved.map((chat) => chat.id),
		['Y', 'X']
	);
	assert.deepEqual(
		browser.saved[1].entries.map((entry) => entry.id),
		['unsaved', 'retry']
	);
});

test('storage events filter unrelated data, handle clear, and stop after cleanup', async () => {
	const browser = setup();
	const tab = browser.createTab();
	await tab.update((chats) => chats);
	const notifications = tab.state.notifications;
	tab.dispatch('other-key', null);
	tab.dispatch(chatHistoryKey, null, {});
	assert.equal(tab.state.notifications, notifications);

	browser.clear();
	tab.dispatch(null, null);
	assert.deepEqual(tab.state.chats, []);
	assert.equal(browser.writes, 0);
	tab.destroy();
	tab.dispatch(chatHistoryKey, null);
	assert.equal(tab.state.notifications, notifications + 1);
});
