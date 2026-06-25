import fs from 'node:fs/promises';
import { inspectFile } from '@cadcrawl/cad-toolbox/src/inspect.js';
import { CAD_VIEW_DIRECTIONS } from '@cadcrawl/cad-toolbox/src/render-options.js';
import { renderStem } from './cache.js';

export async function analyzeFile(absolutePath, relativePath, cache, kind) {
  if (kind === 'text') return analyzeTextFile(absolutePath);

  const fields = new Set(['metadata', 'renders']);
  if (kind === 'cad' && /\.(step|stp)$/i.test(relativePath)) fields.add('tree');
  if (kind === 'pdf') fields.add('text');

  const options = {
    width: 1200,
    height: 900,
    outputDir: cache.rendersDirectory,
    output: null,
    outputStem: renderStem(relativePath),
    views: [{ name: 'iso-front', direction: CAD_VIEW_DIRECTIONS['iso-front'] }],
    page: 1,
    pages: null,
    background: { r: 247, g: 246, b: 242 },
    edgeOutline: true,
    fullText: false,
  };

  const result = await inspectFile(absolutePath, fields, options);
  return {
    metadata: result.metadata ?? null,
    tree: result.tree ?? null,
    text: result.text ?? null,
    previewPath: result.renders?.[0] ?? null,
  };
}

async function analyzeTextFile(absolutePath) {
  const stat = await fs.stat(absolutePath);
  const maximumBytes = 256 * 1024;
  const bytesToRead = Math.min(stat.size, maximumBytes);
  const handle = await fs.open(absolutePath, 'r');
  let text;
  try {
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  } finally {
    await handle.close();
  }

  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  return {
    metadata: {
      text: {
        lines,
        words,
        characters: text.length,
        truncated: stat.size > maximumBytes,
      },
    },
    tree: null,
    text,
    previewPath: null,
  };
}
