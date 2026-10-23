import { dev } from '$app/environment';
import * as publicEnv from '$env/static/public';

import type { QueryResponse } from '$lib/types/rag';

// A namespace import also works when the optional development variable is absent.
const env: Record<string, string | undefined> = publicEnv;
const apiBaseUrl = env.PUBLIC_API_BASE_URL?.trim() || (dev ? 'http://localhost:8000' : '');

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
