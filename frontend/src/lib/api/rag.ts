import { dev } from '$app/env';
import { PUBLIC_API_BASE_URL } from '$app/env/public';

import type { QueryResponse } from '#lib/types/rag.js';

const configuredUrl = PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
const apiBaseUrl = configuredUrl || (dev ? 'http://localhost:8000' : '');

export async function queryRag(query: string): Promise<QueryResponse> {
	const response = await fetch(`${apiBaseUrl}/query`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query })
	}).catch(() => {
		throw new Error(`Cannot reach the RAG API at ${apiBaseUrl || '/query'}. Is it running?`);
	});

	if (!response.ok) {
		const detail = await response
			.json()
			.then((body) => body?.detail)
			.catch(() => null);
		throw new Error(detail ?? `Request failed (${response.status}).`);
	}

	return response.json() as Promise<QueryResponse>;
}
