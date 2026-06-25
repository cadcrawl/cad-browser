import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import express from 'express';
import { resolveInside } from './path-safety.js';
import { openFile, revealFile } from './reveal-file.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(store, options = {}) {
  const app = express();
  const reveal = options.revealFile ?? revealFile;
  const openWithDefaultApp = options.openFile ?? openFile;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/project', (_request, response) => {
    response.json(store.publicSnapshot());
  });

  app.post('/api/rescan', async (_request, response, next) => {
    try {
      response.json(await store.rescan());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/analyze', (request, response) => {
    const relativePath = String(request.body?.path ?? '');
    const file = store.findFile(relativePath);
    if (!file) return response.status(404).json({ error: 'File not found' });
    store.enqueue(relativePath, Boolean(request.body?.force));
    return response.status(202).json({ status: 'queued' });
  });

  app.post('/api/reveal', async (request, response, next) => {
    try {
      const relativePath = String(request.body?.path ?? '');
      const file = store.findFile(relativePath);
      if (!file) return response.status(404).json({ error: 'File not found' });
      await reveal(await store.rawFile(relativePath));
      return response.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/open', async (request, response, next) => {
    try {
      const relativePath = String(request.body?.path ?? '');
      const file = store.findFile(relativePath);
      if (!file) return response.status(404).json({ error: 'File not found' });
      await openWithDefaultApp(await store.rawFile(relativePath));
      return response.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/raw', async (request, response, next) => {
    try {
      response.sendFile(await store.rawFile(String(request.query.path ?? '')));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/preview', async (request, response, next) => {
    try {
      const requestedPath = String(request.query.path ?? '');
      const absolutePath = resolveInside(store.cache.rendersDirectory, requestedPath);
      response.type('png').send(await fs.readFile(absolutePath));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/events', (request, response) => {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const sendFile = (file) => response.write(`event: file\ndata: ${JSON.stringify(file)}\n\n`);
    const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
    store.on('file', sendFile);
    request.on('close', () => {
      clearInterval(heartbeat);
      store.off('file', sendFile);
    });
  });

  const clientDirectory = options.clientDirectory
    ?? path.resolve(moduleDirectory, '../dist/client');
  app.use(express.static(clientDirectory, { index: false, maxAge: '1h' }));
  app.get('*splat', (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')));

  app.use((error, _request, response, _next) => {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  });

  return app;
}
