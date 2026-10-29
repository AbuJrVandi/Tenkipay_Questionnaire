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
  const connection = {
    query: async sql => {
      if (sql === 'BEGIN') calls.push('begin');
      if (sql.startsWith('SELECT id FROM submissions')) return { rows: [] };
      if (sql === 'ROLLBACK') calls.push('rollback');
      return { rows: [] };
    },
    release: () => calls.push('release')
  };
  await assert.rejects(() => deleteResponses({ connect: async () => connection }, [id], 1), /no longer exist/);
  assert.deepEqual(calls, ['begin', 'rollback', 'release']);
});
