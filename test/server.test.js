import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('reveals a known project file through the injected platform handler', async () => {
  let revealedPath = null;
  const store = {
    findFile(relativePath) {
      return relativePath === 'parts/part.step' ? { path: relativePath } : null;
    },
    async rawFile() {
      return 'C:\\project\\parts\\part.step';
    },
    publicSnapshot() {
      return {};
    },
    on() {},
    off() {},
    cache: { rendersDirectory: 'C:\\cache' },
  };
  const app = await createServer(store, {
    revealFile: async (filePath) => {
      revealedPath = filePath;
    },
  });
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'parts/part.step' }),
    });

    assert.equal(response.status, 200);
    assert.equal(revealedPath, 'C:\\project\\parts\\part.step');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('opens a known project file with the injected default application handler', async () => {
  let openedPath = null;
  const store = {
    findFile(relativePath) {
      return relativePath === 'drawing.pdf' ? { path: relativePath } : null;
    },
    async rawFile() {
      return 'C:\\project\\drawing.pdf';
    },
    publicSnapshot() {
      return {};
    },
    on() {},
    off() {},
    cache: { rendersDirectory: 'C:\\cache' },
  };
  const app = await createServer(store, {
    openFile: async (filePath) => {
      openedPath = filePath;
    },
  });
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'drawing.pdf' }),
    });

    assert.equal(response.status, 200);
    assert.equal(openedPath, 'C:\\project\\drawing.pdf');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
