import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResponseIds, deleteResponses } from '../server/response-deletion.js';
const id = '12345678-1234-1234-1234-123456789012';
test('deletion rejects invalid, duplicate, empty and oversized selections', () => {
  for (const ids of [undefined, [], ['invalid'], [id, id], Array(101).fill(id)]) assert.throws(() => validateResponseIds(ids));
  assert.deepEqual(validateResponseIds([id]), [id]);
});
test('deletion rolls back when a selected response no longer exists', async () => {
  const calls = [];
  const connection = { beginTransaction: async () => {}, query: async () => [[]], rollback: async () => calls.push('rollback'), release: () => calls.push('release') };
  await assert.rejects(() => deleteResponses({ getConnection: async () => connection }, [id], 1), /no longer exist/);
  assert.deepEqual(calls, ['rollback', 'release']);
});
