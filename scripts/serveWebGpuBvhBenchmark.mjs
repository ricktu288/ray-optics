import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.WEBGPU_BVH_BENCHMARK_PORT ?? 8000);
const directory = dirname(fileURLToPath(import.meta.url));
const benchmarkPath = join(directory, 'benchmarkWebGpuBvh.html');

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${host}:${port}`).pathname;
  if (pathname !== '/' && pathname !== '/benchmarkWebGpuBvh.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  try {
    const html = await readFile(benchmarkPath);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(html);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error?.stack ?? String(error));
  }
});

server.listen(port, host, () => {
  console.log(`WebGPU BVH benchmark: http://${host}:${port}/`);
  console.log('Leave this process running while the page is open.');
});
