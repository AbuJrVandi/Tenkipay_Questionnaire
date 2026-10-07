import { spawn } from 'node:child_process';
const commands = [['--watch', 'server/index.js'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort']];
const children = commands.map(args => spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true }));
let exiting = false;
const close = code => { if (exiting) return; exiting = true; children.forEach(child => child.kill()); process.exitCode = code || 0; };
children.forEach(child => child.on('exit', close));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => close(0));
