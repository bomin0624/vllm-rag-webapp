import type { ChatSession } from './types/chat.js';

export const chatHistoryKey = 'rag-chat-history';

type Mutation = (chats: ChatSession[]) => ChatSession[];

export function createChatHistory({
	storage,
	events,
	locks,
	onChange
}: {
	storage: Pick<Storage, 'getItem' | 'setItem'>;
	events: EventTarget;
	locks?: { request(name: string, callback: () => void): Promise<unknown> };
	onChange: (chats: ChatSession[], error: string) => void;
}) {
	let savedChats: ChatSession[] = [];
	let pending: Mutation[] = [];
	let storageError = '';
	let destroyed = false;
	let queue = Promise.resolve();

	function read() {
		const value = storage.getItem(chatHistoryKey);
		try {
			const parsed = JSON.parse(value ?? '[]');
			savedChats = Array.isArray(parsed) ? parsed : [];
		} catch {
			savedChats = [];
		}
		return value;
	}

	function currentChats() {
		return pending.reduce((chats, mutate) => mutate(chats), savedChats);
	}

	function notify() {
		if (!destroyed) onChange(currentChats(), storageError);
	}

	function sync(event: Event) {
		const { key, storageArea } = event as StorageEvent;
		if ((key !== chatHistoryKey && key !== null) || storageArea !== storage) return;

		try {
			// Read current storage: a queued event may describe an older write.
			read();
			if (pending.length === 0) storageError = '';
		} catch {
			storageError = 'Chat history storage is unavailable. Changes are only kept in this tab.';
		}
		notify();
	}

	events.addEventListener('storage', sync);

	return {
		update(mutate: Mutation) {
			// Serialize operations within this tab as well as across tabs.
			queue = queue.then(async () => {
				if (destroyed) return;
				pending.push(mutate);
				const commit = () => {
					if (destroyed) return;
					const previous = read();
					const chats = currentChats();
					const value = JSON.stringify(chats);
					if (value !== previous) storage.setItem(chatHistoryKey, value);
					savedChats = chats;
					pending = [];
					storageError = '';
				};

				try {
					// Keep the read/modify/write atomic when tabs update simultaneously.
					if (locks) await locks.request(chatHistoryKey, commit);
					else commit();
				} catch {
					storageError =
						'Chat history could not be saved. Check browser storage or delete an old chat.';
				}
				notify();
			});
			return queue;
		},
		destroy() {
			destroyed = true;
			events.removeEventListener('storage', sync);
		}
	};
}
