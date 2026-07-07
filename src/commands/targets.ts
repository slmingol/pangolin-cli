import { Command } from 'commander';
import chalk from 'chalk';
import { client } from '../api/client';
import { TargetUpdatePayload } from '../types';

function parseSet(setArgs: string[]): TargetUpdatePayload {
  const payload: Record<string, unknown> = {};
  for (const s of setArgs) {
    const [key, val] = s.split('=', 2);
    if (val === 'true') payload[key] = true;
    else if (val === 'false') payload[key] = false;
    else if (!isNaN(Number(val))) payload[key] = Number(val);
    else payload[key] = val;
  }
  return payload as TargetUpdatePayload;
}

export function registerTargetsCommand(program: Command) {
  const cmd = program.command('targets').description('Manage targets');

  cmd
    .command('list')
    .description('List targets for a resource')
    .requiredOption('--resource <id>', 'Resource ID or niceId')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const resourceId = await resolveResourceId(opts.resource);
        const targets = await client.listTargets(resourceId);

        if (opts.json) {
          console.log(JSON.stringify(targets, null, 2));
        } else {
          console.log(chalk.bold(`${'ID'.padEnd(8)} ${'IP'.padEnd(20)} ${'Port'.padEnd(8)} ${'Enabled'.padEnd(10)} HC`));
          for (const t of targets) {
            const enabled = t.enabled === false ? chalk.red('no') : chalk.green('yes');
            const hc = t.hcEnabled ? chalk.green('on') : chalk.dim('off');
            console.log(
              `${String(t.targetId).padEnd(8)} ${(t.ip ?? '').padEnd(20)} ${String(t.port ?? '').padEnd(8)} ${enabled.padEnd(14)} ${hc}`
            );
          }
          console.log(chalk.dim(`\n${targets.length} target(s)`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('retarget')
    .description('Change IP/port on all targets of a resource')
    .requiredOption('--resource <id>', 'Resource ID or niceId')
    .option('--ip <ip>', 'New IP address')
    .option('--port <port>', 'New port', parseInt)
    .option('--dry-run', 'Preview without applying')
    .action(async (opts) => {
      try {
        const resourceId = await resolveResourceId(opts.resource);
        const targets = await client.listTargets(resourceId);

        if (targets.length === 0) {
          console.log(chalk.yellow('No targets found.'));
          return;
        }

        const payload: TargetUpdatePayload = {};
        if (opts.ip) payload.ip = opts.ip;
        if (opts.port) payload.port = opts.port;

        if (Object.keys(payload).length === 0) {
          console.error(chalk.red('Provide --ip and/or --port'));
          process.exit(1);
        }

        console.log(chalk.bold(`${opts.dryRun ? '[DRY RUN] ' : ''}Retargeting ${targets.length} target(s):`));
        for (const t of targets) {
          if (opts.dryRun) {
            console.log(chalk.dim(`  would update target ${t.targetId}: ${t.ip}:${t.port} -> ${opts.ip ?? t.ip}:${opts.port ?? t.port}`));
          } else {
            await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, ...payload });
            console.log(chalk.green(`  updated target ${t.targetId}: ${t.ip}:${t.port} -> ${opts.ip ?? t.ip}:${opts.port ?? t.port}`));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('update')
    .description('Bulk update targets for a resource')
    .option('--resource <id>', 'Resource ID or niceId (omit to apply across all resources)')
    .option('--site <id>', 'Filter by site niceId or siteId (applies across all resources)')
    .option('--set <kv...>', 'Fields to set, e.g. --set hcEnabled=true hcPath=/health')
    .option('--all-resources', 'Apply to targets across all resources')
    .option('--dry-run', 'Preview without applying')
    .action(async (opts) => {
      try {
        const payload = parseSet(opts.set ?? []);
        if (Object.keys(payload).length === 0) {
          console.error(chalk.red('No --set values provided.'));
          process.exit(1);
        }

        const siteId = opts.site ? await resolveSiteId(opts.site) : null;

        if (opts.allResources || opts.site) {
          const resources = await client.getAllResources();
          let total = 0;
          for (const r of resources) {
            const targets = await client.listTargets(r.resourceId);
            const filtered = siteId !== null ? targets.filter((t) => t.siteId === siteId) : targets;
            for (const t of filtered) {
              total++;
              if (opts.dryRun) {
                console.log(chalk.dim(`  would update target ${t.targetId} (resource: ${r.name}, site: ${t.siteId})`));
              } else {
                await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, ...payload });
                console.log(chalk.green(`  updated target ${t.targetId} (resource: ${r.name})`));
              }
            }
          }
          if (opts.dryRun) console.log(chalk.bold(`\n[DRY RUN] would update ${total} target(s)`));
          else console.log(chalk.bold(`\nUpdated ${total} target(s)`));
          return;
        }

        if (!opts.resource) {
          console.error(chalk.red('Provide --resource <id>, --site <id>, or --all-resources'));
          process.exit(1);
        }

        const resourceId = await resolveResourceId(opts.resource);
        const targets = await client.listTargets(resourceId);

        console.log(chalk.bold(`${opts.dryRun ? '[DRY RUN] ' : ''}Updating ${targets.length} target(s):`));
        console.log(chalk.dim('Payload:'), payload);

        for (const t of targets) {
          if (opts.dryRun) {
            console.log(chalk.dim(`  would update target ${t.targetId}`));
          } else {
            await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, ...payload });
            console.log(chalk.green(`  updated target ${t.targetId}`));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('delete')
    .description('Delete a target by ID')
    .requiredOption('--target-id <id>', 'Target ID', parseInt)
    .option('--dry-run', 'Preview without deleting')
    .action(async (opts) => {
      try {
        if (opts.dryRun) {
          console.log(chalk.dim(`would delete target ${opts.targetId}`));
          return;
        }
        await client.deleteTarget(opts.targetId);
        console.log(chalk.red(`deleted target ${opts.targetId}`));
      } catch (err) {
        handleError(err);
      }
    });
}

async function resolveResourceId(idOrNiceId: string): Promise<number> {
  const n = Number(idOrNiceId);
  if (!isNaN(n)) return n;
  const resources = await client.getAllResources();
  const match = resources.find((r) => r.niceId === idOrNiceId || r.name === idOrNiceId);
  if (!match) throw new Error(`Resource not found: ${idOrNiceId}`);
  return match.resourceId;
}

async function resolveSiteId(idOrNiceId: string): Promise<number> {
  const n = Number(idOrNiceId);
  if (!isNaN(n)) return n;
  const sites = await client.listSites();
  const match = sites.find((s) => s.niceId === idOrNiceId || s.name === idOrNiceId);
  if (!match) throw new Error(`Site not found: ${idOrNiceId}`);
  return match.siteId;
}

function handleError(err: unknown): never {
  if (err instanceof Error) console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}
