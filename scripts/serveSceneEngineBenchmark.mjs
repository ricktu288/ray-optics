import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSceneEngineBenchmarkManifest
} from './sceneEngineBenchmarkManifest.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const host = '127.0.0.1';
const port = Number(process.env.SCENE_ENGINE_BENCHMARK_PORT ?? 8002);
const skipBuild = process.argv.includes('--skip-build');
const listScenes = process.argv.includes('--list-scenes');
const manifest = buildSceneEngineBenchmarkManifest(repoRoot);

if (listScenes) {
  for (const scene of manifest) {
    const suffix = scene.hasDensityResponsiveSource ? ' + 5x-linear' : '';
    console.log(`${scene.group}/${scene.id}${suffix}`);
  }
  process.exit(0);
}

if (!skipBuild) buildBrowserBundle();

const htmlPath = path.join(scriptDirectory, 'benchmarkSceneEngines.html');
const bundlePath = path.join(
  repoRoot, 'dist/experiments/scene-engine-benchmark.js'
);
if (!fs.existsSync(bundlePath)) {
  throw new Error(
    'The scene-engine benchmark bundle is missing. Run without --skip-build.'
  );
}

const publicManifest = manifest.map(({ filePath: _filePath, ...scene }) => scene);
const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '/benchmarkSceneEngines.html') {
      return sendFile(response, htmlPath, 'text/html; charset=utf-8');
    }
    if (pathname === '/scene-engine-benchmark.js') {
      return sendFile(response, bundlePath, 'text/javascript; charset=utf-8');
    }
    if (pathname === '/scene-engine-benchmark-manifest.json') {
      return sendJson(response, publicManifest);
    }
    const sceneMatch = /^\/benchmark-scene\/(\d+)\.json$/.exec(pathname);
    if (sceneMatch) {
      const scene = manifest[Number(sceneMatch[1])];
      if (!scene) return sendNotFound(response);
      return sendFile(response, scene.filePath, 'application/json; charset=utf-8');
    }
    if (pathname.startsWith('/gallery/')) {
      const filename = path.basename(pathname);
      if (filename !== pathname.slice('/gallery/'.length)) {
        return sendNotFound(response);
      }
      return sendFile(
        response,
        path.join(repoRoot, 'data/galleryScenes', filename),
        contentType(filename)
      );
    }
    if (pathname === '/favicon.ico') return sendNotFound(response);
    return sendNotFound(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error?.stack ?? String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Scene engine benchmark: http://${host}:${port}/`);
  console.log(
    `${manifest.length} authored scenes; ` +
    `${manifest.filter(scene => scene.hasDensityResponsiveSource).length} ` +
    'additional 5x-linear variants.'
  );
  console.log('Leave this process running while the benchmark page is open.');
});

function buildBrowserBundle() {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/webpack/bin/webpack.js'),
      '--config',
      path.join(repoRoot, 'webpack.scene-benchmark.config.mjs'),
      '--mode',
      'production',
    ],
    { cwd: repoRoot, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Scene benchmark build exited with status ${result.status}.`);
  }
}

function sendFile(response, filePath, type) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendNotFound(response);
  }
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(response);
}

function sendJson(response, value) {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function sendNotFound(response) {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

function contentType(filename) {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}
