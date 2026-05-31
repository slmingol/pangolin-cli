import { Command } from 'commander';
import chalk from 'chalk';
import { client } from '../api/client';
import { Resource, ResourceUpdatePayload } from '../types';

function matchesFilter(resource: Resource, filter: string): boolean {
  // filter format: "field=value" or glob on name e.g. "*prod*"
  if (filter.includes('=')) {
    const [key, val] = filter.split('=', 2);
    const rval = String((resource as unknown as Record<string, unknown>)[key] ?? '');
    return rval === val;
  }
  const pattern = new RegExp('^' + filter.replace(/\*/g, '.*') + '$', 'i');
  return pattern.test(resource.name) || pattern.test(resource.niceId);
}

function parseSet(setArgs: string[]): ResourceUpdatePayload {
  const payload: Record<string, unknown> = {};
  for (const s of setArgs) {
    const [key, val] = s.split('=', 2);
    if (val === 'true') payload[key] = true;
    else if (val === 'false') payload[key] = false;
    else if (!isNaN(Number(val))) payload[key] = Number(val);
    else payload[key] = val;
  }
  return payload as ResourceUpdatePayload;
}

export function registerResourcesCommand(program: Command) {
  const cmd = program.command('resources').description('Manage resources');

  cmd
    .command('list')
    .description('List all resources')
    .option('--filter <pattern>', 'Filter by name/niceId glob or field=value')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        let resources = await client.getAllResources();
        if (opts.filter) resources = resources.filter((r) => matchesFilter(r, opts.filter));

        if (opts.json) {
          console.log(JSON.stringify(resources, null, 2));
        } else {
          console.log(chalk.bold(`${'ID'.padEnd(6)} ${'NiceID'.padEnd(30)} ${'Name'.padEnd(40)} SSO    Enabled`));
          for (const r of resources) {
            const sso = r.sso ? chalk.yellow('sso') : chalk.green('open');
            const enabled = r.enabled === false ? chalk.red('disabled') : chalk.green('enabled');
            console.log(
              `${String(r.resourceId).padEnd(6)} ${(r.niceId ?? '').padEnd(30)} ${(r.name ?? '').padEnd(40)} ${sso.padEnd(12)} ${enabled}`
            );
          }
          console.log(chalk.dim(`\n${resources.length} resource(s)`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('update')
    .description('Bulk update resources matching a filter')
    .requiredOption('--filter <pattern>', 'Filter by name/niceId glob or field=value')
    .option('--set <kv...>', 'Fields to set, e.g. --set sso=false enabled=true')
    .option('--dry-run', 'Preview without applying')
    .action(async (opts) => {
      try {
        const resources = (await client.getAllResources()).filter((r) =>
          matchesFilter(r, opts.filter)
        );

        if (resources.length === 0) {
          console.log(chalk.yellow('No resources matched filter.'));
          return;
        }

        const payload = parseSet(opts.set ?? []);
        if (Object.keys(payload).length === 0) {
          console.error(chalk.red('No --set values provided.'));
          process.exit(1);
        }

        console.log(chalk.bold(`${opts.dryRun ? '[DRY RUN] ' : ''}Updating ${resources.length} resource(s):`));
        console.log(chalk.dim('Payload:'), payload);

        for (const r of resources) {
          if (opts.dryRun) {
            console.log(chalk.dim(`  would update: ${r.name} (${r.resourceId})`));
          } else {
            await client.updateResource(r.resourceId, payload);
            console.log(chalk.green(`  updated: ${r.name} (${r.resourceId})`));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('delete')
    .description('Bulk delete resources matching a filter')
    .requiredOption('--filter <pattern>', 'Filter by name/niceId glob or field=value')
    .option('--dry-run', 'Preview without deleting')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts) => {
      try {
        const resources = (await client.getAllResources()).filter((r) =>
          matchesFilter(r, opts.filter)
        );

        if (resources.length === 0) {
          console.log(chalk.yellow('No resources matched filter.'));
          return;
        }

        console.log(chalk.bold(`${opts.dryRun ? '[DRY RUN] ' : ''}${resources.length} resource(s) will be deleted:`));
        for (const r of resources) {
          console.log(`  ${r.name} (${r.resourceId})`);
        }

        if (opts.dryRun) return;

        if (!opts.yes) {
          const { default: readline } = await import('readline');
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          await new Promise<void>((resolve, reject) =>
            rl.question(chalk.red('\nType "yes" to confirm deletion: '), (ans) => {
              rl.close();
              if (ans !== 'yes') {
                console.log('Aborted.');
                reject(new Error('aborted'));
              } else {
                resolve();
              }
            })
          );
        }

        for (const r of resources) {
          await client.deleteResource(r.resourceId);
          console.log(chalk.red(`  deleted: ${r.niceId} (${r.resourceId})`));
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'aborted') process.exit(0);
        handleError(err);
      }
    });
}

function handleError(err: unknown): never {
  if (err instanceof Error) console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}
