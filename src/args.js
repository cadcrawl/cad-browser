export function parseArgs(argv) {
  const options = { port: 6767, open: true, host: '127.0.0.1', directory: '.' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') options.help = true;
    else if (value === '--no-open') options.open = false;
    else if (value === '--port') options.port = Number(argv[++index]);
    else if (value === '--host') options.host = argv[++index];
    else if (!value.startsWith('-')) options.directory = value;
    else throw new Error(`Unknown option: ${value}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }
  return options;
}
