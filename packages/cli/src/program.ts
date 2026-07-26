import { Command, CommanderError, Option } from 'commander';
import { ApiError } from '@snippetvault/api-client';
import { CliError, red, type Io } from './io.js';
import { login } from './commands/login.js';
import { save } from './commands/save.js';
import { find } from './commands/find.js';
import { get } from './commands/get.js';

const collect = (value: string, prev: string[] = []) => [...prev, value];

export function buildProgram(io: Io) {
  const program = new Command('sv')
    .description('Save and find SnippetVault snippets from the terminal')
    .version('3.2.0')
    .exitOverride()
    .configureOutput({ writeOut: s => io.stdout.write(s), writeErr: s => io.stderr.write(s) });

  program.command('login')
    .description('save the server url and an access token')
    .option('--url <url>', 'server url, default http://localhost:3001')
    .option('--token <token>', 'token, or pipe it in')
    .action(opts => login(io, opts));

  program.command('save')
    .description('save a file, or code from stdin, as a snippet')
    .argument('[file]', 'file to save, - or nothing for stdin')
    .option('-t, --title <title>', 'title, default is the file name')
    .option('-l, --lang <language>', 'language, default from the file extension')
    .option('-d, --desc <text>', 'description')
    .option('--tag <tag>', 'tag, can repeat', collect)
    .option('-p, --project <id>', 'project id')
    .addOption(new Option('--visibility <who>', 'who can see it').choices(['private', 'project', 'shared']))
    .action((file, opts) => save(io, file, opts));

  program.command('find')
    .description('search your snippets')
    .argument('[words...]', 'search words, empty lists everything')
    .option('-l, --lang <language>', 'only this language')
    .option('-p, --project <id>', 'only this project')
    .option('--tag <tag>', 'only with this tag, can repeat', collect)
    .option('-n, --limit <n>', 'how many to show', '20')
    .option('--json', 'print json, for scripts')
    .action((words, opts) => find(io, words, opts));

  program.command('get')
    .description('print the code of a snippet')
    .argument('<id>', 'snippet id, from sv find')
    .option('-c, --copy', 'copy to clipboard instead of printing')
    .option('--json', 'print the whole snippet as json')
    .action((id, opts) => get(io, id, opts));

  return program;
}

export async function run(argv: string[], io: Io): Promise<number> {
  try {
    await buildProgram(io).parseAsync(argv, { from: 'user' });
    return 0;
  } catch (err) {
    if (err instanceof CommanderError) return err.exitCode;
    if (err instanceof ApiError && err.status === 401) {
      io.stderr.write(red(io, 'sv: token not valid or revoked, run sv login again') + '\n');
    } else if (err instanceof CliError || err instanceof ApiError) {
      io.stderr.write(red(io, `sv: ${err.message}`) + '\n');
    } else if (err instanceof TypeError && String(err.cause ?? '').includes('ECONNREFUSED')) {
      io.stderr.write(red(io, 'sv: cant reach the server, is it running?') + '\n');
    } else {
      throw err;
    }
    return 1;
  }
}
