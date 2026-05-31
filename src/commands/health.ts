import { Command } from 'commander';
import chalk from 'chalk';
import { client } from '../api/client';

export function registerHealthCommand(program: Command) {
  const cmd = program.command('health').description('Manage health checks on targets');

  cmd
    .command('list')
    .description('List org-level health checks')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const checks = await client.listHealthChecks();
        if (opts.json) {
          console.log(JSON.stringify(checks, null, 2));
        } else {
          console.log(chalk.bold(`${'ID'.padEnd(8)} ${'Mode'.padEnd(10)} Name`));
          for (const hc of checks) {
            console.log(`${String(hc.healthCheckId).padEnd(8)} ${(hc.mode ?? '').padEnd(10)} ${hc.name}`);
          }
          console.log(chalk.dim(`\n${checks.length} health check(s)`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('enable')
    .description('Enable health checking on all targets of a resource (or all resources)')
    .option('--resource <id>', 'Resource ID or niceId')
    .option('--all-resources', 'Apply to all resources')
    .option('--path <path>', 'Health check path', '/health')
    .option('--scheme <scheme>', 'http or https', 'http')
    .option('--interval <ms>', 'Check interval in ms', parseInt, 10000)
    .option('--timeout <ms>', 'Timeout in ms', parseInt, 5000)
    .option('--healthy-threshold <n>', 'Consecutive successes to mark healthy', parseInt, 2)
    .option('--unhealthy-threshold <n>', 'Consecutive failures to mark unhealthy', parseInt, 3)
    .option('--dry-run', 'Preview without applying')
    .action(async (opts) => {
      try {
        const hcPayload = {
          hcEnabled: true,
          hcPath: opts.path,
          hcScheme: opts.scheme,
          hcMode: 'http',
          hcInterval: opts.interval,
          hcTimeout: opts.timeout,
          hcHealthyThreshold: opts.healthyThreshold,
          hcUnhealthyThreshold: opts.unhealthyThreshold,
        };

        const resources = opts.allResources
          ? await client.getAllResources()
          : [await resolveResource(opts.resource)];

        for (const r of resources) {
          const targets = await client.listTargets(r.resourceId);
          for (const t of targets) {
            if (opts.dryRun) {
              console.log(chalk.dim(`  would enable HC on target ${t.targetId} (${r.niceId})`));
            } else {
              await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, hcHostname: t.ip, hcPort: t.port, ...hcPayload });
              console.log(chalk.green(`  enabled HC on target ${t.targetId} (${r.niceId})`));
            }
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('disable')
    .description('Disable health checking on all targets of a resource (or all resources)')
    .option('--resource <id>', 'Resource ID or niceId')
    .option('--all-resources', 'Apply to all resources')
    .option('--dry-run', 'Preview without applying')
    .action(async (opts) => {
      try {
        const resources = opts.allResources
          ? await client.getAllResources()
          : [await resolveResource(opts.resource)];

        for (const r of resources) {
          const targets = await client.listTargets(r.resourceId);
          for (const t of targets) {
            if (opts.dryRun) {
              console.log(chalk.dim(`  would disable HC on target ${t.targetId} (${r.niceId})`));
            } else {
              await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, hcEnabled: false });
              console.log(chalk.yellow(`  disabled HC on target ${t.targetId} (${r.niceId})`));
            }
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('status')
    .description('Show health check config on all targets for a resource')
    .requiredOption('--resource <id>', 'Resource ID or niceId')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const r = await resolveResource(opts.resource);
        const targets = await client.listTargets(r.resourceId);

        if (opts.json) {
          console.log(JSON.stringify(targets.map((t) => ({
            targetId: t.targetId,
            ip: t.ip,
            port: t.port,
            hcEnabled: t.hcEnabled,
            hcPath: t.hcPath,
            hcScheme: t.hcScheme,
            hcInterval: t.hcInterval,
            hcTimeout: t.hcTimeout,
            hcHealthyThreshold: t.hcHealthyThreshold,
            hcUnhealthyThreshold: t.hcUnhealthyThreshold,
          })), null, 2));
          return;
        }

        for (const t of targets) {
          const status = t.hcEnabled ? chalk.green('enabled') : chalk.dim('disabled');
          console.log(`Target ${t.targetId} (${t.ip}:${t.port}): HC ${status}`);
          if (t.hcEnabled) {
            console.log(`  path=${t.hcPath ?? '/'} scheme=${t.hcScheme ?? 'http'} interval=${t.hcInterval}ms timeout=${t.hcTimeout}ms`);
            console.log(`  healthy threshold=${t.hcHealthyThreshold} unhealthy threshold=${t.hcUnhealthyThreshold}`);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}

async function resolveResource(idOrNiceId: string) {
  const resources = await client.getAllResources();
  const n = Number(idOrNiceId);
  const match = !isNaN(n)
    ? resources.find((r) => r.resourceId === n)
    : resources.find((r) => r.niceId === idOrNiceId || r.name === idOrNiceId);
  if (!match) throw new Error(`Resource not found: ${idOrNiceId}`);
  return match;
}

function handleError(err: unknown): never {
  if (err instanceof Error) console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}
