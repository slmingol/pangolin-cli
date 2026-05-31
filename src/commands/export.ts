import { Command } from 'commander';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import chalk from 'chalk';
import { client } from '../api/client';
import { Resource, Target } from '../types';

interface ExportedResource {
  resourceId: number;
  niceId: string;
  name: string;
  fullDomain?: string;
  ssl?: boolean;
  sso?: boolean;
  blockAccess?: boolean;
  enabled?: boolean;
  stickySession?: boolean;
  maintenanceModeEnabled?: boolean;
  targets: Omit<Target, 'resourceId'>[];
}

export function registerExportCommand(program: Command) {
  program
    .command('export')
    .description('Export all resources and targets to YAML or JSON')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--format <format>', 'Output format: yaml or json', 'yaml')
    .option('--include-sites', 'Also export sites')
    .action(async (opts) => {
      try {
        process.stderr.write(chalk.dim('Fetching resources...\n'));
        const resources = await client.getAllResources();

        process.stderr.write(chalk.dim(`Fetching targets for ${resources.length} resources...\n`));
        const exported: ExportedResource[] = await Promise.all(
          resources.map(async (r: Resource) => {
            const targets = await client.listTargets(r.resourceId);
            return {
              resourceId: r.resourceId,
              niceId: r.niceId,
              name: r.name,
              fullDomain: r.fullDomain,
              ssl: r.ssl,
              sso: r.sso,
              blockAccess: r.blockAccess,
              enabled: r.enabled,
              stickySession: r.stickySession,
              maintenanceModeEnabled: r.maintenanceModeEnabled,
              targets: targets.map(({ resourceId: _rid, ...t }) => t),
            };
          })
        );

        const output: Record<string, unknown> = { resources: exported };

        if (opts.includeSites) {
          process.stderr.write(chalk.dim('Fetching sites...\n'));
          output.sites = await client.listSites();
        }

        const content =
          opts.format === 'json'
            ? JSON.stringify(output, null, 2)
            : yaml.dump(output, { lineWidth: 120 });

        if (opts.output) {
          fs.writeFileSync(opts.output, content, 'utf-8');
          console.error(chalk.green(`Exported ${resources.length} resources to ${opts.output}`));
        } else {
          process.stdout.write(content);
        }
      } catch (err) {
        handleError(err);
      }
    });
}

function handleError(err: unknown): never {
  if (err instanceof Error) {
    console.error(chalk.red('Error:'), err.message);
  }
  process.exit(1);
}
