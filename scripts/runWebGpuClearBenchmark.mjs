/*
 * Run benchmarkWebGpuClear.html in headless Chromium without Puppeteer.
 * Chromium's --dump-dom virtual clock can stop while WebGPU work is pending,
 * so this runner polls the real page through the DevTools protocol instead.
 */

import { spawn } from 'node:child_process';
import {
  mkdtempSync, readFileSync, rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chromium = process.env.CHROMIUM_BIN ?? '/usr/bin/chromium-browser';
const extraChromiumFlags = (process.env.WEBGPU_CHROMIUM_FLAGS ?? '')
  .split(/\s+/).filter(Boolean);
const userDataDir = mkdtempSync(join(tmpdir(), 'ray-optics-webgpu-clear-'));
const benchmarkPath = join(
  dirname(fileURLToPath(import.meta.url)), 'benchmarkWebGpuClear.html'
);
const query = new URLSearchParams({
  capacity: process.env.WEBGPU_CLEAR_CAPACITY ?? '1048576',
  repetitions: process.env.WEBGPU_CLEAR_REPETITIONS ?? '16',
  samples: process.env.WEBGPU_CLEAR_SAMPLES ?? '3'
});
const benchmarkUrl = `${pathToFileURL(benchmarkPath)}?${query}`;
const chromiumErrors = [];
const child = spawn(chromium, [
  '--headless=new',
  '--no-sandbox',
  '--enable-unsafe-webgpu',
  '--disable-gpu-sandbox',
  '--disable-dev-shm-usage',
  '--remote-debugging-port=0',
  `--user-data-dir=${userDataDir}`,
  ...extraChromiumFlags,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => {
  chromiumErrors.push(chunk);
  if (chromiumErrors.length > 20) chromiumErrors.shift();
});

try {
  const activePortPath = join(userDataDir, 'DevToolsActivePort');
  await waitUntil(() => {
    try {
      return readFileSync(activePortPath, 'utf8');
    } catch {
      return null;
    }
  }, 15000);
  const [port] = readFileSync(activePortPath, 'utf8').trim().split('\n');
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(response => response.json());
  const page = targets.find(target => target.type === 'page');
  if (!page) throw new Error('Chromium did not expose a page target.');
  const cdp = createCdpClient(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Page.navigate', { url: benchmarkUrl });
  const body = await waitUntil(async () => {
    const response = await cdp.call('Runtime.evaluate', {
      expression: 'document.body?.textContent ?? ""',
      returnByValue: true
    });
    const value = response.result?.result?.value?.trim() ?? '';
    return value.startsWith('{') || value.startsWith('ERROR:')
      ? value
      : null;
  }, 180000, 50);
  cdp.close();
  if (body.startsWith('ERROR:')) throw new Error(body);
  const report = JSON.parse(body);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const chromiumLog = chromiumErrors.join('').trim();
  if (chromiumLog) console.error(chromiumLog);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
  rmSync(userDataDir, { recursive: true, force: true });
}

function createCdpClient(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback?.reject(new Error(message.error.message));
    else callback?.resolve(message);
  });
  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    }),
    call(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function waitUntil(probe, timeoutMs, intervalMs = 20) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs} ms.`);
}
