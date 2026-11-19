/** `--name value`, `--flag` 형식만 다루는 작은 인자 파서 */
export function parseArgs(argv: string[] = process.argv.slice(2)) {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [name, inline] = a.slice(2).split("=", 2);
    if (inline !== undefined) values.set(name, inline);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) values.set(name, argv[++i]);
    else flags.add(name);
  }
  return {
    has: (name: string) => flags.has(name) || values.has(name),
    get: (name: string) => values.get(name),
  };
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
