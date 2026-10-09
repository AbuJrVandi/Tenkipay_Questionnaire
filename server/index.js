import 'dotenv/config';
import { app } from './app.js';
import { pool, databaseDriver, getQuestionnaire } from './db.js';
import { ensureSchema } from './schema.js';
try {
  await ensureSchema(pool, databaseDriver);
  await getQuestionnaire();
} catch (error) {
  console.error('Database startup failed. Check database settings and run npm run db:setup.', error.code || error.message);
  await pool.end();
  process.exit(1);
}
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => console.log(`TenkiPay API: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
