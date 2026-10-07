import 'dotenv/config';
import { app } from './app.js';
import { pool } from './db.js';
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => console.log(`TenkiPay API: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
