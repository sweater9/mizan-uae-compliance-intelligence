import { readdir, readFile } from 'node:fs/promises';
for (const directory of ['dist/client', 'pages-dist']) {
 for (const file of await readdir(directory, { recursive: true })) {
  if (!/\.(html|js)$/.test(file)) continue;
  const content = await readFile(`${directory}/${file}`, 'utf8');
  if (/NVIDIA_API_KEY|NVIDIA_NIM|integrate\.api\.nvidia|qa-build-secret-sentinel|NVIDIA-backed/.test(content)) throw Error(`Server configuration leaked to ${directory}/${file}`);
 }
}
console.log('Both client builds exclude server configuration and the build sentinel.');
