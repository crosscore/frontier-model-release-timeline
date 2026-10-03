import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { options } from './options.mjs';
const args = options({ port: { type: 'string', default: '4173' } });
const port = Number(args.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const types = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json', '.vtt': 'text/vtt', '.ttf': 'font/ttf', '.csv': 'text/csv; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(args.out, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(args.out + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (req.headers.range && !range) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
    const start = range ? Number(range[1]) : 0, end = range && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    res.writeHead(range ? 206 : 200, { ...headers, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') res.end(); else createReadStream(file, { start, end }).pipe(res);
  } catch { res.writeHead(404).end('Not found. Run npm run build and npm run render first.'); }
});
await readFile(resolve(args.out, 'index.html'));
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port} (Ctrl-C to stop)`));
