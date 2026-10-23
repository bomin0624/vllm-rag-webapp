import assert from 'node:assert/strict';
import test from 'node:test';

import { createId } from '../src/lib/create-id.ts';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('uses native randomUUID when available on localhost or HTTPS', (t) => {
	const randomUUID = t.mock.method(crypto, 'randomUUID');

	assert.match(createId(), uuidV4);
	assert.equal(randomUUID.mock.callCount(), 1);
});

test('creates distinct UUIDs without randomUUID on HTTP server origins', (t) => {
	const nativeCrypto = globalThis.crypto;
	t.mock.getter(globalThis, 'crypto', () => ({
		getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto)
	}));

	const ids = Array.from({ length: 100 }, () => createId());
	for (const id of ids) assert.match(id, uuidV4);
	assert.equal(new Set(ids).size, ids.length);
});
