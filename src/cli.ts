#!/usr/bin/env node
import { Command } from 'commander';
import { registerExportCommand } from './commands/export';
import { registerResourcesCommand } from './commands/resources';
import { registerTargetsCommand } from './commands/targets';
import { registerHealthCommand } from './commands/health';
import { runInteractive } from './commands/interactive';
import { runDashboard } from './commands/dashboard';

const program = new Command();

program
  .name('pangolin-cli')
  .description('CLI tools for managing Pangolin resources')
  .version('0.1.0')
  .action(() => runInteractive());

program
  .command('dashboard')
  .description('Live health check status dashboard (polls every 10s)')
  .action(() => runDashboard());

registerExportCommand(program);
registerResourcesCommand(program);
registerTargetsCommand(program);
registerHealthCommand(program);

program.parse(process.argv);
