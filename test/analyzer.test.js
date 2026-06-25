import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeFile } from '../src/analyzer.js';

test('analyzes Markdown and text content for search and inspection', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cad-browser-text-'));
  const filePath = path.join(root, 'README.md');
  try {
    await fs.writeFile(filePath, '# Assembly\n\nThree engineering words.');
    const result = await analyzeFile(filePath, 'README.md', { rendersDirectory: root }, 'text');

    assert.equal(result.text, '# Assembly\n\nThree engineering words.');
    assert.deepEqual(result.metadata.text, {
      lines: 3,
      words: 5,
      characters: 36,
      truncated: false,
    });
    assert.equal(result.previewPath, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
