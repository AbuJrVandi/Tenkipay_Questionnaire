import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import 'dotenv/config';

const apiPort = Number(process.env.PORT || 3001);
async function listening(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}
const [apiRunning, webRunning] = await Promise.all([listening(apiPort), listening(5173)]);
if (apiRunning || webRunning) {
  let existingWorkspace = false;
  if (apiRunning && webRunning) {
    try {
      const [health, questionnaire] = await Promise.all([
        fetch('http://127.0.0.1:5173/api/health', { signal: AbortSignal.timeout(3000) }),
        fetch('http://127.0.0.1:5173/api/public/questionnaire', { signal: AbortSignal.timeout(3000) })
      ]);
      const [status, schema] = await Promise.all([health.json(), questionnaire.json()]);
      existingWorkspace = health.ok && questionnaire.ok && status.database === 'connected' && Array.isArray(schema.questions);
    } catch { /* Report occupied ports below without stopping existing processes. */ }
  }
  if (existingWorkspace) {
    console.log('TenkiPay is already running and the database is connected.');
    console.log('Admin: http://localhost:5173/admin');
    console.log('Form:  http://localhost:5173/form');
    process.exit(0);
  }
  console.error(`Cannot start: local port(s) ${[apiRunning && apiPort, webRunning && 5173].filter(Boolean).join(', ')} are already in use.`);
  console.error('Close the terminal running the previous development server and retry. Existing processes have been left running.');
  process.exit(1);
}
const commands = [['--watch', 'server/index.js'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort']];
const children = commands.map(args => spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true }));
let exiting = false;
const close = code => { if (exiting) return; exiting = true; children.forEach(child => child.kill()); process.exitCode = code || 0; };
children.forEach(child => child.on('exit', close));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close(0));
