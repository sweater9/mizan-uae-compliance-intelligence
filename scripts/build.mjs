import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], { stdio: 'inherit' });
const timer = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 10000).unref(); }, 180000);
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1; });
child.on('error', () => { clearTimeout(timer); process.exitCode = 1; });
