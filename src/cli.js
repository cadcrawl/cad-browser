import fs from 'node:fs/promises';
import path from 'node:path';
import open from 'open';
import { parseArgs } from './args.js';
import { ProjectStore } from './project-store.js';
import { createServer } from './server.js';

const HELP = `cad-browser

Browse an engineering project with local CAD/PDF previews and metadata.

USAGE
  npx @cadcrawl/cad-browser [directory] [options]

OPTIONS
  --port <number>  Local port, default 6767
  --host <address> Bind address, default 127.0.0.1
  --no-open        Do not open the browser automatically
  --help           Show this help

EXAMPLES
  npx @cadcrawl/cad-browser
  npx @cadcrawl/cad-browser C:\\engineering\\project
  npx @cadcrawl/cad-browser . --port 6767 --no-open
`;

export async function run(argv) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const rootPath = path.resolve(options.directory);
    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) throw new Error(`Not a directory: ${rootPath}`);

    const store = new ProjectStore(rootPath);
    await store.initialize();
    const app = await createServer(store);
    const server = app.listen(options.port, options.host, async () => {
      const url = `http://${options.host}:${options.port}`;
      process.stdout.write(`CAD Browser\n${rootPath}\n${url}\n`);
      if (options.open) await open(url);
    });
    const close = () => server.close(() => process.exit(0));
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
  } catch (error) {
    process.stderr.write(`cad-browser: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
