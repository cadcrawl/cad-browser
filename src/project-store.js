import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { scanProject } from './scanner.js';
import { analyzeFile } from './analyzer.js';
import { createProjectCache, readCache, writeCache } from './cache.js';
import { resolveInside } from './path-safety.js';

export class ProjectStore extends EventEmitter {
  constructor(rootPath) {
    super();
    this.rootPath = path.resolve(rootPath);
    this.cache = null;
    this.cacheIndex = null;
    this.snapshot = null;
    this.queue = [];
    this.queued = new Set();
    this.active = 0;
    this.concurrency = 2;
    this.cacheWrite = Promise.resolve();
  }

  async initialize() {
    this.cache = await createProjectCache(this.rootPath);
    this.cacheIndex = await readCache(this.cache);
    await this.rescan();
  }

  async rescan() {
    const scanned = await scanProject(this.rootPath);
    const files = scanned.files.map((file) => {
      const cached = this.cacheIndex.files[file.path];
      const fresh = cached?.modifiedKey === file.modifiedKey;
      return {
        ...file,
        status: file.analyzable ? (fresh ? 'ready' : 'queued') : 'plain',
        analysis: fresh ? cached.analysis : null,
      };
    });
    this.snapshot = {
      rootName: path.basename(this.rootPath),
      rootPath: this.rootPath,
      scannedAt: new Date().toISOString(),
      tree: scanned.tree,
      files,
      counts: countKinds(files),
    };
    this.emit('snapshot', this.publicSnapshot());
    for (const file of files.filter((item) => item.analyzable && item.status === 'queued')) {
      this.enqueue(file.path);
    }
    return this.publicSnapshot();
  }

  publicSnapshot() {
    return {
      ...this.snapshot,
      rootPath: this.rootPath,
      cachePath: this.cache.directory,
    };
  }

  findFile(relativePath) {
    return this.snapshot.files.find((file) => file.path === relativePath) ?? null;
  }

  enqueue(relativePath, force = false) {
    const file = this.findFile(relativePath);
    if (!file?.analyzable || this.queued.has(relativePath)) return;
    if (!force && file.status === 'ready') return;
    file.status = 'queued';
    this.queue.push({ relativePath, force });
    this.queued.add(relativePath);
    this.pump();
  }

  async pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.active += 1;
      this.process(job).finally(() => {
        this.active -= 1;
        this.queued.delete(job.relativePath);
        this.pump();
      });
    }
  }

  async process({ relativePath }) {
    const file = this.findFile(relativePath);
    if (!file) return;
    file.status = 'processing';
    this.emit('file', file);
    try {
      const absolutePath = resolveInside(this.rootPath, relativePath);
      const analysis = await analyzeFile(absolutePath, relativePath, this.cache, file.kind);
      file.analysis = analysis;
      file.status = 'ready';
      file.error = null;
      this.cacheIndex.files[relativePath] = {
        modifiedKey: file.modifiedKey,
        analysis,
      };
      this.cacheWrite = this.cacheWrite.then(() => writeCache(this.cache, this.cacheIndex));
      await this.cacheWrite;
    } catch (error) {
      file.status = 'error';
      file.error = error instanceof Error ? error.message : String(error);
    }
    this.emit('file', file);
  }

  async rawFile(relativePath) {
    const absolutePath = resolveInside(this.rootPath, relativePath);
    await fs.access(absolutePath);
    return absolutePath;
  }
}

function countKinds(files) {
  return files.reduce((counts, file) => {
    counts.total += 1;
    counts[file.kind] = (counts[file.kind] ?? 0) + 1;
    if (file.analyzable) counts.engineering += 1;
    return counts;
  }, { total: 0, engineering: 0, cad: 0, pdf: 0, image: 0, text: 0, file: 0 });
}
