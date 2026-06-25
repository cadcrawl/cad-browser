import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function createProjectCache(rootPath) {
  const projectId = crypto.createHash('sha256').update(rootPath.toLowerCase()).digest('hex').slice(0, 20);
  const directory = path.join(os.homedir(), '.cadcrawl', 'cad-browser', 'projects', projectId);
  const rendersDirectory = path.join(directory, 'renders');
  await fs.mkdir(rendersDirectory, { recursive: true });
  return {
    directory,
    rendersDirectory,
    indexPath: path.join(directory, 'index.json'),
  };
}

export async function readCache(cache) {
  try {
    return JSON.parse(await fs.readFile(cache.indexPath, 'utf8'));
  } catch {
    return { version: 1, files: {} };
  }
}

export async function writeCache(cache, value) {
  const temporaryPath = `${cache.indexPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2));
  await fs.rename(temporaryPath, cache.indexPath);
}

export function renderStem(relativePath) {
  const hash = crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 10);
  const base = path.basename(relativePath, path.extname(relativePath))
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .slice(0, 60);
  return `${base || 'asset'}-${hash}`;
}
