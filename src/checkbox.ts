import readline from 'readline';
import chalk from 'chalk';

export interface Choice<T> {
  name: string;
  value: T;
  short?: string;
}

export async function checkbox<T>(opts: {
  message: string;
  choices: Choice<T>[];
  pageSize?: number;
  validate?: (selected: T[]) => boolean | string;
}): Promise<T[]> {
  const { message, choices, pageSize = 20, validate } = opts;
  const selected = new Set<number>();
  let cursor = 0;
  let offset = 0;

  const rl = readline.createInterface({ input: process.stdin });
  readline.emitKeypressEvents(process.stdin, rl);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  const visibleCount = Math.min(pageSize, choices.length);

  function render() {
    process.stdout.write('\x1B[?25l'); // hide cursor
    const lines: string[] = [];
    lines.push(chalk.green('?') + ' ' + chalk.bold(message));
    lines.push(chalk.dim('  (space=toggle+next, a=all, i=invert, enter=confirm)'));

    for (let i = 0; i < visibleCount; i++) {
      const idx = offset + i;
      if (idx >= choices.length) break;
      const isCursor = idx === cursor;
      const isSelected = selected.has(idx);
      const check = isSelected ? chalk.green('◉') : chalk.dim('◯');
      const name = isCursor ? chalk.cyan('❯ ') + choices[idx].name : '  ' + choices[idx].name;
      lines.push(` ${check} ${name}`);
    }

    if (choices.length > visibleCount) {
      lines.push(chalk.dim(`  (${offset + 1}-${Math.min(offset + visibleCount, choices.length)} of ${choices.length})`));
    }

    process.stdout.write(lines.join('\n') + '\n');
  }

  function clear(lineCount: number) {
    for (let i = 0; i < lineCount; i++) {
      process.stdout.write('\x1B[1A\x1B[2K');
    }
  }

  function lineCount() {
    const extra = choices.length > visibleCount ? 1 : 0;
    return 2 + Math.min(visibleCount, choices.length) + extra;
  }

  function scrollToCursor() {
    if (cursor < offset) offset = cursor;
    if (cursor >= offset + visibleCount) offset = cursor - visibleCount + 1;
  }

  render();

  return new Promise((resolve, reject) => {
    function onKeypress(_: unknown, key: readline.Key) {
      if (!key) return;

      const lc = lineCount();

      if (key.name === 'c' && key.ctrl) {
        cleanup();
        reject(new Error('force closed'));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const result = [...selected].map((i) => choices[i].value);
        const verdict = validate ? validate(result) : true;
        if (verdict !== true) {
          clear(lc);
          render();
          return;
        }
        cleanup();
        const names = [...selected].map((i) => choices[i].short ?? choices[i].name).join(', ');
        process.stdout.write(chalk.green('?') + ' ' + chalk.bold(message) + ' ' + chalk.cyan(names || '(none)') + '\n');
        resolve(result);
        return;
      }

      if (key.name === 'up') {
        cursor = Math.max(0, cursor - 1);
        scrollToCursor();
      } else if (key.name === 'down') {
        cursor = Math.min(choices.length - 1, cursor + 1);
        scrollToCursor();
      } else if (key.name === 'space') {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        // auto-advance
        if (cursor < choices.length - 1) {
          cursor++;
          scrollToCursor();
        }
      } else if (key.name === 'a') {
        if (selected.size === choices.length) selected.clear();
        else choices.forEach((_, i) => selected.add(i));
      } else if (key.name === 'i') {
        choices.forEach((_, i) => {
          if (selected.has(i)) selected.delete(i);
          else selected.add(i);
        });
      }

      clear(lc);
      render();
    }

    process.stdin.on('keypress', onKeypress);

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      process.stdout.write('\x1B[?25h'); // show cursor
    }
  });
}
