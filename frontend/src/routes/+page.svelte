<script lang="ts">
	import { queryRag } from '#lib/api/rag.js';
	import { createChatHistory } from '#lib/chat-history.js';
	import { createId } from '#lib/create-id.js';
	import type { ChatEntry, ChatSession } from '#lib/types/chat.js';
	import { onMount, tick } from 'svelte';

	type Submission = Pick<ChatEntry, 'id' | 'query'> & { chatId: string | null; error?: string };

	let history: ReturnType<typeof createChatHistory>;

	let chats = $state<ChatSession[]>([]);
	let activeChatId = $state<string | null>(null);
	let query = $state('');
	let submission = $state<Submission | null>(null);
	let storageError = $state('');
	let isLoading = $state(false);
	let conversation: HTMLDivElement;
	let isHistoryOpen = $state(false);
	let historyToggle: HTMLButtonElement;
	let chatPendingDeletion = $state<string | null>(null);
	let deleteDialog: HTMLDialogElement;
	let activeChat = $derived(chats.find((chat) => chat.id === activeChatId) ?? null);
	let activeSubmission = $derived(submission?.chatId === activeChatId ? submission : null);
	let activeEntries = $derived.by(() => {
		const entries = activeChat?.entries ?? [];
		const prompt = activeSubmission;
		if (prompt && (isLoading || prompt.error) && !entries.some((entry) => entry.id === prompt.id)) {
			return [...entries, { id: prompt.id, query: prompt.query, response: null }];
		}
		return entries;
	});

	onMount(() => {
		history = createChatHistory({
			storage: localStorage,
			events: window,
			locks: navigator.locks,
			onChange(updatedChats, error) {
				chats = updatedChats;
				storageError = error;
				if (!chats.some((chat) => chat.id === activeChatId)) {
					activeChatId = chats[0]?.id ?? null;
					void scrollToLatest();
				}
				if (chatPendingDeletion && !chats.some((chat) => chat.id === chatPendingDeletion)) {
					chatPendingDeletion = null;
					deleteDialog.close();
				}
			}
		});
		const firstChat = createChatSession();
		void history.update((savedChats) => (savedChats.length > 0 ? savedChats : [firstChat]));
		return () => history.destroy();
	});

	function createChatSession(): ChatSession {
		return {
			id: createId(),
			title: 'New chat',
			entries: [],
			updatedAt: Date.now()
		};
	}

	async function startNewChat() {
		const newChat = createChatSession();
		await history.update((savedChats) => [newChat, ...savedChats]);
		activeChatId = newChat.id;
		query = '';
		closeHistory();
		return newChat.id;
	}

	function selectChat(chatId: string) {
		activeChatId = chatId;
		closeHistory();
		void scrollToLatest();
	}

	async function scrollToLatest() {
		await tick();
		conversation?.scrollTo({ top: conversation.scrollHeight });
	}

	async function scrollToPrompt(chatId: string, entryId: string) {
		await tick();
		if (activeChatId !== chatId) return;

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.getElementById(`chat-entry-${entryId}`)?.scrollIntoView({
			block: 'start',
			behavior: reduceMotion ? 'instant' : 'smooth'
		});
	}

	function closeHistory() {
		if (!isHistoryOpen) return;

		isHistoryOpen = false;
		historyToggle?.focus();
	}

	function requestDeleteChat(chatId: string) {
		chatPendingDeletion = chatId;
		deleteDialog.showModal();
	}

	async function deleteChat() {
		const chatId = chatPendingDeletion;
		if (!chatId) return;

		chatPendingDeletion = null;
		deleteDialog.close();

		const replacement = createChatSession();
		await history.update((savedChats) => {
			const remainingChats = savedChats.filter((chat) => chat.id !== chatId);
			return remainingChats.length > 0 ? remainingChats : [replacement];
		});
		if (activeChatId === replacement.id) {
			query = '';
			closeHistory();
		}
	}

	function makeTitle(question: string) {
		return question.length > 28 ? `${question.slice(0, 28)}...` : question;
	}

	function previewExcerpt(excerpt: string) {
		const text = excerpt.replace(/\s+/g, ' ');
		return text.length <= 160 ? text : `${text.slice(0, 160).trimEnd()}…`;
	}

	async function submitQuery() {
		const question = query.trim();

		if (!question || isLoading) return;

		const entryId = createId();
		let chatId = activeChatId;
		submission = { id: entryId, chatId, query: question };
		isLoading = true;
		query = '';

		try {
			if (!chatId) {
				chatId = await startNewChat();
				submission.chatId = chatId;
			}
			void scrollToPrompt(chatId, entryId);
			const response = await queryRag(question);
			const entry: ChatEntry = { id: entryId, query: question, response };

			await history.update((savedChats) =>
				savedChats
					.map((chat) => {
						if (chat.id !== chatId) return chat;

						return {
							...chat,
							title: chat.entries.length === 0 ? makeTitle(question) : chat.title,
							entries: [...chat.entries, entry],
							updatedAt: Date.now()
						};
					})
					.sort((first, second) => second.updatedAt - first.updatedAt)
			);
		} catch (caughtError) {
			submission.error =
				caughtError instanceof Error
					? caughtError.message
					: 'An unexpected error occurred. Please try again.';
			if (activeChatId === chatId && !query) query = question;
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>RAG Terminal</title>
	<meta name="description" content="A terminal-style interface for a local RAG knowledge base." />
</svelte:head>

<main class="flex h-dvh flex-col overflow-hidden bg-[#060707] font-mono text-slate-200">
	<div class="shrink-0 border-b border-white/10 px-5 py-3 sm:px-8 lg:hidden">
		<button
			bind:this={historyToggle}
			type="button"
			onclick={() => (isHistoryOpen = !isHistoryOpen)}
			aria-label={isHistoryOpen ? 'Close chat history' : 'Open chat history'}
			aria-expanded={isHistoryOpen}
			aria-controls="chat-sidebar"
			title={isHistoryOpen ? 'Close chat history' : 'Open chat history'}
			class="grid size-11 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-300/5 text-cyan-300 transition [corner-shape:squircle] hover:bg-cyan-300/10 aria-expanded:border-cyan-300 aria-expanded:bg-cyan-300/15"
		>
			<span
				aria-hidden="true"
				class="relative h-4 w-5 rounded-sm border border-current before:absolute before:inset-y-0 before:left-1.5 before:border-l before:border-current after:absolute after:top-1 after:right-0.5 after:h-1.5 after:w-1.5 after:border-y after:border-current"
			></span>
		</button>
	</div>
	<div
		class="relative mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]"
	>
		<aside
			id="chat-sidebar"
			class={`absolute inset-x-0 top-0 z-10 max-h-[min(70dvh,100%)] flex-col border-b border-white/10 bg-[#060707] lg:static lg:flex lg:max-h-none lg:border-r lg:border-b-0 lg:bg-black/25 ${isHistoryOpen ? 'flex' : 'hidden'}`}
		>
			<div class="border-b border-white/10 px-5 py-7">
				<p class="text-xl font-bold tracking-[0.18em] text-cyan-300">RAG</p>
				<p class="mt-2 text-[10px] tracking-[0.15em] text-slate-600">V0.1 // LOCAL</p>
			</div>

			<div class="p-4">
				<button
					onclick={startNewChat}
					class="min-h-11 w-full rounded-xl border border-cyan-300 bg-cyan-300 px-3 py-2 text-left text-xs font-bold tracking-wider text-black transition [corner-shape:squircle] hover:bg-cyan-100"
				>
					+ NEW CHAT
				</button>
			</div>

			<nav class="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Chat history">
				<p class="mb-2 px-2 text-[10px] font-bold tracking-[0.16em] text-slate-600">CHAT HISTORY</p>
				<div class="space-y-1">
					{#each chats as chat (chat.id)}
						<div
							class={`group flex w-full border-l-2 transition hover:bg-white/5 ${
								chat.id === activeChatId
									? 'border-cyan-300 bg-cyan-300/5 text-cyan-200'
									: 'border-transparent text-slate-500'
							}`}
						>
							<button
								onclick={() => selectChat(chat.id)}
								class="min-w-0 flex-1 px-3 py-3 text-left text-sm"
							>
								<span class="block truncate">{chat.title}</span>
								<span class="mt-1 block text-[10px] text-slate-700"
									>{chat.entries.length} QUERIES</span
								>
							</button>
							<button
								onclick={() => requestDeleteChat(chat.id)}
								class="m-2 grid size-11 place-items-center text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 lg:size-7 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100 lg:pointer-coarse:opacity-100"
								aria-label={`Delete ${chat.title}`}
								title="Delete chat"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									class="size-4"
									aria-hidden="true"
								>
									<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			</nav>

			<div class="border-t border-white/10 px-5 py-5">
				<p class="text-xs font-bold text-slate-400">LOCAL_STORAGE</p>
				<p
					class="mt-1 text-xs"
					class:text-red-400={!!storageError}
					class:text-emerald-400={!storageError}
				>
					STATUS: {storageError ? 'NOT SAVED' : 'SAVED'}
				</p>
			</div>
		</aside>

		<div class="flex min-h-0 min-w-0 flex-col">
			<header
				class="flex min-h-18 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8"
			>
				<p class="truncate text-xs font-bold tracking-wide text-slate-500 sm:text-sm">
					ROOT <span class="text-slate-700">/</span> RAG <span class="text-slate-700">/</span>
					<span class="text-slate-200">{activeChat?.title ?? 'NEW CHAT'}</span>
				</p>
				<div class="flex shrink-0 items-center gap-2 text-[10px] font-bold sm:text-xs">
					<button
						onclick={startNewChat}
						aria-label="New chat"
						class="min-h-11 rounded-xl border border-cyan-400/40 bg-cyan-300/5 px-2.5 text-cyan-300 transition [corner-shape:squircle] hover:bg-cyan-300/10 lg:hidden"
					>
						+ NEW
					</button>
					<span
						class="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-emerald-400 [corner-shape:squircle]"
						>API: LOCAL</span
					>
				</div>
			</header>

			<div
				bind:this={conversation}
				class="@container-size min-h-0 flex-1 scroll-pt-(--chat-padding) overflow-y-auto [--chat-padding:--spacing(5)] sm:[--chat-padding:--spacing(8)]"
			>
				<div class="mx-auto max-w-6xl space-y-5 p-(--chat-padding)">
					{#if activeEntries.length}
						<section class="space-y-4" aria-label="Chat messages">
							{#each activeEntries as entry, index (entry.id)}
								<article
									id={`chat-entry-${entry.id}`}
									class:latest-submission={entry.id === activeSubmission?.id &&
										index === activeEntries.length - 1}
								>
									<div
										class="overflow-clip rounded-3xl border border-white/15 bg-black/20 wrap-anywhere [corner-shape:squircle]"
									>
										<div class="border-b border-white/10 px-5 py-4 text-sm text-slate-100">
											<span class="font-bold text-cyan-300">rag@local:~$</span>
											<span class="ml-3 whitespace-pre-wrap">{entry.query}</span>
										</div>
										{#if entry.response}
											<div
												class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-xs"
											>
												<h2 class="font-bold tracking-widest text-cyan-300">RESPONSE_OUTPUT</h2>
												<span class="text-slate-500">MODEL: {entry.response.model}</span>
											</div>
											<p class="px-5 py-5 text-sm leading-7 whitespace-pre-wrap text-slate-200">
												{entry.response.answer}
											</p>

											<div class="border-t border-white/10 px-5 py-4">
												<h3 class="mb-3 text-sm font-bold text-cyan-300">
													Sources used for this answer
												</h3>
												<div class="space-y-2">
													{#each entry.response.sources as source, sourceIndex (source.id)}
														{@const title = source.title?.trim()}
														{@const content = source.content.trim()}
														{@const excerpt = title ? content : content.replace(/^\.(?:\s+|$)/, '')}
														<details
															class="rounded-xl border border-white/15 bg-[#080b0b] [corner-shape:squircle]"
														>
															<summary
																class="cursor-pointer px-4 py-3 text-sm text-slate-200 marker:text-cyan-300"
															>
																<span class="ml-2 font-medium"
																	>{title || `Source ${sourceIndex + 1}`}</span
																>
																{#if !title && excerpt}
																	<span
																		class="mt-1 ml-5 line-clamp-2 text-xs leading-5 text-slate-400"
																	>
																		{previewExcerpt(excerpt)}
																	</span>
																{/if}
															</summary>
															<div class="border-t border-white/10 px-4 py-3">
																<p class="text-sm leading-6 whitespace-pre-wrap text-slate-300">
																	{excerpt || 'No excerpt is available for this source.'}
																</p>
																{#if source.id && source.id !== 'unknown_id'}
																	<p class="mt-2 text-xs text-slate-400">
																		Document ID: {source.id}
																	</p>
																{/if}
															</div>
														</details>
													{:else}
														<p class="text-sm text-slate-400">No source documents were found.</p>
													{/each}
												</div>
											</div>
										{:else if activeSubmission?.error}
											<p class="bg-red-950/20 px-5 py-4 text-sm text-red-200" role="alert">
												<span class="font-bold text-red-400">ERROR:</span>
												{activeSubmission.error}
											</p>
										{:else}
											<p class="px-5 py-4 text-sm text-cyan-300" role="status">
												&gt;&gt; Retrieving source documents and generating response...
											</p>
										{/if}
									</div>
								</article>
							{/each}
						</section>
					{/if}

					{#if storageError}
						<div
							class="border border-red-400/50 bg-red-950/20 p-4 text-sm text-red-200"
							role="alert"
						>
							<span class="font-bold text-red-400">STORAGE ERROR:</span>
							{storageError}
						</div>
					{/if}
				</div>
			</div>

			<div class="shrink-0 border-t border-white/10">
				<section id="query" class="mx-auto max-w-6xl px-5 py-3 sm:px-8 sm:py-4">
					<form
						class="rounded-3xl border border-white/15 bg-[#080b0b] [corner-shape:squircle]"
						onsubmit={(event) => {
							event.preventDefault();
							submitQuery();
						}}
					>
						<label class="sr-only" for="query-input">Question</label>
						<div class="flex items-start gap-3 px-4 py-4">
							<span class="pt-1 text-sm font-bold whitespace-nowrap text-cyan-300"
								>rag@local:~$</span
							>
							<textarea
								id="query-input"
								bind:value={query}
								placeholder="type your query..."
								rows="2"
								maxlength="1000"
								class="max-h-[25dvh] min-h-14 min-w-0 flex-1 resize-y bg-transparent text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
							></textarea>
						</div>
						<div class="flex items-center justify-between border-t border-white/10 px-4 py-3">
							<p class="text-[10px] tracking-wider text-slate-600">MAX INPUT: 1000 CHARACTERS</p>
							<button
								type="submit"
								disabled={isLoading || !query.trim()}
								class="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold tracking-wider text-black transition [corner-shape:squircle] hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
							>
								{isLoading ? 'PROCESSING...' : 'RUN QUERY'}
							</button>
						</div>
					</form>
				</section>
			</div>
		</div>
	</div>

	<dialog
		bind:this={deleteDialog}
		onclose={() => (chatPendingDeletion = null)}
		class="fixed top-1/2 right-auto bottom-auto left-1/2 m-0 h-fit w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-cyan-300/60 bg-[#080b0b] shadow-2xl shadow-cyan-950/30 backdrop:bg-black/75 backdrop:backdrop-blur-sm"
		aria-labelledby="delete-dialog-title"
	>
		<div class="flex items-center justify-between border-b border-white/10 px-5 py-3">
			<h2 id="delete-dialog-title" class="text-xs font-bold tracking-[0.16em] text-cyan-300">
				CONFIRM_DELETION
			</h2>
			<span class="text-xs text-red-400">[ WARNING ]</span>
		</div>
		<div class="px-5 py-6 text-sm leading-7 text-slate-300">
			<p>
				<span class="font-bold text-cyan-300">&gt;</span> Delete this chat and all of its saved queries?
			</p>
			<p class="mt-2 text-xs text-slate-600">THIS ACTION CANNOT BE UNDONE.</p>
		</div>
		<div
			class="flex justify-end gap-3 border-t border-white/10 px-5 py-4 text-xs font-bold tracking-wider"
		>
			<button
				onclick={() => deleteDialog.close()}
				class="border border-slate-600 px-3 py-2 text-slate-300 transition hover:border-slate-300 hover:text-white"
			>
				CANCEL
			</button>
			<button
				onclick={deleteChat}
				class="border border-red-400 bg-red-400 px-3 py-2 text-black transition hover:bg-red-300"
			>
				DELETE CHAT
			</button>
		</div>
	</dialog>
</main>

<style>
	/* Leave enough space to align the prompt with the top when its reply is short. */
	.latest-submission {
		min-height: calc(100cqh - 2 * var(--chat-padding));
	}
</style>
