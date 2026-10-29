export function validateResponseIds(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(ids).size !== ids.length) throw Object.assign(new Error('Select 1–100 unique response IDs.'), { status: 422 });
  return ids;
}
export async function deleteResponses(pool, ids, adminId) {
  validateResponseIds(ids);
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const { rows } = await connection.query('SELECT id FROM submissions WHERE id = ANY($1) FOR UPDATE', [ids]);
    if (rows.length !== ids.length) throw Object.assign(new Error('Some responses no longer exist. Refresh the list and select again.'), { status: 409 });
    await connection.query('DELETE FROM submissions WHERE id = ANY($1)', [ids]);
    await connection.query('INSERT INTO audit_log (admin_id, action, details) VALUES ($1, $2, $3)', [adminId, 'responses.deleted', JSON.stringify({ ids, count: ids.length })]);
    await connection.query('COMMIT');
    return { deleted: ids.length };
  } catch (error) { await connection.query('ROLLBACK'); throw error; } finally { connection.release(); }
}
