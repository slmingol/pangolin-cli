import inquirer from 'inquirer';
import chalk from 'chalk';
import { client } from '../api/client';
import { Resource, TargetUpdatePayload, ResourceUpdatePayload } from '../types';
import { checkbox } from '../checkbox';

export async function runInteractive() {
  console.log(chalk.bold('\nPangolin CLI\n'));

  while (true) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: [
        { name: 'Export current config to YAML', value: 'export' },
        { name: 'List resources', value: 'list' },
        { name: 'Update resources', value: 'update' },
        { name: 'Delete resources', value: 'delete' },
        { name: 'Manage health checks', value: 'health' },
        new inquirer.Separator(),
        { name: 'Exit', value: 'exit' },
      ],
    }]);

    if (action === 'exit') break;

    try {
      if (action === 'export') await doExport();
      if (action === 'list') await doList();
      if (action === 'update') await doUpdate();
      if (action === 'delete') await doDelete();
      if (action === 'health') await doHealth();
    } catch (err) {
      if (err instanceof Error && err.message.includes('force closed')) break;
      console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
    }

    console.log();
  }
}

async function doExport() {
  const { file } = await inquirer.prompt([{
    type: 'input',
    name: 'file',
    message: 'Output file:',
    default: 'current.yaml',
  }]);

  const { format } = await inquirer.prompt([{
    type: 'list',
    name: 'format',
    message: 'Format:',
    choices: ['yaml', 'json'],
    default: 'yaml',
  }]);

  const resources = await fetchWithSpinner('Fetching resources...');
  const yaml = await import('js-yaml');
  const fs = await import('fs');

  const exported = await Promise.all(resources.map(async (r) => {
    const targets = await client.listTargets(r.resourceId);
    return { ...r, targets };
  }));

  const content = format === 'json'
    ? JSON.stringify({ resources: exported }, null, 2)
    : yaml.dump({ resources: exported }, { lineWidth: 120 });

  fs.writeFileSync(file, content, 'utf-8');
  console.log(chalk.green(`\nExported ${resources.length} resources to ${file}`));
}

async function doList() {
  const resources = await fetchWithSpinner('Fetching resources...');

  console.log();
  console.log(chalk.bold(`${'Name'.padEnd(40)} ${'SSO'.padEnd(8)} Enabled`));
  console.log(chalk.dim('─'.repeat(60)));
  for (const r of resources) {
    const sso = r.sso ? chalk.yellow('sso') : chalk.green('open');
    const enabled = r.enabled === false ? chalk.red('disabled') : chalk.green('enabled');
    console.log(`${(r.name ?? '').padEnd(40)} ${sso.padEnd(12)} ${enabled}`);
  }
  console.log(chalk.dim(`\n${resources.length} resource(s)`));
}

async function doUpdate() {
  const resources = await fetchWithSpinner('Fetching resources...');

  const selected = await checkbox<Resource>({
    message: 'Select resources to update:',
    choices: resources.map((r) => ({
      name: `${r.name.padEnd(40)} ${r.sso ? chalk.yellow('sso') : chalk.green('open')}`,
      value: r,
      short: r.name,
    })),
    pageSize: 20,
    validate: (ans) => ans.length > 0 || 'Select at least one resource.',
  });

  const { category } = await inquirer.prompt([{
    type: 'list',
    name: 'category',
    message: 'What do you want to change?',
    choices: [
      new inquirer.Separator('── Resource settings ──'),
      { name: 'SSO / Authentication', value: 'sso' },
      { name: 'Block access', value: 'blockAccess' },
      { name: 'Enabled / Disabled', value: 'enabled' },
      { name: 'Sticky session', value: 'stickySession' },
      { name: 'Maintenance mode', value: 'maintenanceModeEnabled' },
      new inquirer.Separator('── Target settings ──'),
      { name: 'Backend IP address', value: 'target:ip' },
      { name: 'Backend port', value: 'target:port' },
      { name: 'Target enabled / disabled', value: 'target:enabled' },
      { name: 'Health check configuration', value: 'target:health' },
    ],
  }]);

  const isTargetUpdate = category.startsWith('target:');

  if (!isTargetUpdate) {
    const fieldLabel: Record<string, string> = {
      sso: 'Enable SSO authentication?',
      blockAccess: 'Block all access?',
      enabled: 'Enable resource?',
      stickySession: 'Enable sticky sessions?',
      maintenanceModeEnabled: 'Enable maintenance mode?',
    };

    const { value } = await inquirer.prompt([{
      type: 'confirm',
      name: 'value',
      message: fieldLabel[category],
    }]);

    const payload: ResourceUpdatePayload = { [category]: value };

    console.log(chalk.bold(`\nWill set ${category}=${value} on ${(selected).length} resource(s):`));
    for (const r of selected) console.log(chalk.dim(`  ${r.name}`));

    const { confirm } = await inquirer.prompt([{
      type: 'confirm', name: 'confirm', message: 'Apply changes?', default: false,
    }]);
    if (!confirm) { console.log('Aborted.'); return; }

    for (const r of selected) {
      await client.updateResource(r.resourceId, payload);
      console.log(chalk.green(`  updated: ${r.name}`));
    }
    return;
  }

  // Target-level updates
  const field = category.split(':')[1];
  let targetPayload: TargetUpdatePayload = {};

  if (field === 'ip') {
    const { ip } = await inquirer.prompt([{ type: 'input', name: 'ip', message: 'New backend IP:' }]);
    targetPayload = { ip };
  } else if (field === 'port') {
    const { port } = await inquirer.prompt([{ type: 'input', name: 'port', message: 'New backend port:', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' }]);
    targetPayload = { port: Number(port) };
  } else if (field === 'enabled') {
    const { value } = await inquirer.prompt([{ type: 'confirm', name: 'value', message: 'Enable targets?' }]);
    targetPayload = { enabled: value };
  } else if (field === 'health') {
    targetPayload = await promptHcConfig();
  }

  console.log(chalk.bold(`\nWill update targets on ${(selected).length} resource(s):`));
  for (const r of selected) console.log(chalk.dim(`  ${r.name}`));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm', message: 'Apply changes?', default: false,
  }]);
  if (!confirm) { console.log('Aborted.'); return; }

  for (const r of selected) {
    const targets = await client.listTargets(r.resourceId);
    for (const t of targets) {
      const hcDefaults = targetPayload.hcEnabled ? { hcHostname: t.ip, hcPort: t.port } : {};
      await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, ...hcDefaults, ...targetPayload });
    }
    console.log(chalk.green(`  updated targets on: ${r.name}`));
  }
}

async function doDelete() {
  const resources = await fetchWithSpinner('Fetching resources...');

  const selected = await checkbox<Resource>({
    message: 'Select resources to delete:',
    choices: resources.map((r) => ({
      name: `${r.name.padEnd(40)} ${r.fullDomain ?? ''}`,
      value: r,
      short: r.name,
    })),
    pageSize: 20,
    validate: (ans) => ans.length > 0 || 'Select at least one resource.',
  });

  console.log(chalk.red(`\nWill permanently delete ${selected.length} resource(s):`));
  for (const r of selected) {
    console.log(chalk.red(`  ${r.name} (${r.fullDomain ?? r.resourceId})`));
  }

  const { confirm } = await inquirer.prompt([{
    type: 'input',
    name: 'confirm',
    message: `Type "delete" to confirm:`,
  }]);

  if (confirm !== 'delete') { console.log('Aborted.'); return; }

  for (const r of selected) {
    await client.deleteResource(r.resourceId);
    console.log(chalk.red(`  deleted: ${r.name}`));
  }
}

async function doHealth() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Health check action:',
    choices: [
      { name: 'View status on a resource', value: 'status' },
      new inquirer.Separator(),
      { name: 'Configure & enable on selected resources', value: 'configure-some' },
      { name: 'Configure & enable on ALL resources', value: 'configure-all' },
      new inquirer.Separator(),
      { name: 'Disable on selected resources', value: 'disable-some' },
      { name: 'Disable on ALL resources', value: 'disable-all' },
    ],
  }]);

  const resources = await fetchWithSpinner('Fetching resources...');

  if (action === 'status') {
    const { resource } = await inquirer.prompt([{
      type: 'list',
      name: 'resource',
      message: 'Which resource?',
      choices: resources.map((r) => ({ name: r.name, value: r })),
      pageSize: 20,
    }]);
    const targets = await client.listTargets((resource as Resource).resourceId);
    console.log();
    for (const t of targets) {
      const hc = t.hcEnabled ? chalk.green('enabled') : chalk.dim('disabled');
      console.log(`  Target ${t.targetId} (${t.ip}:${t.port}): HC ${hc}`);
      if (t.hcEnabled) {
        console.log(`    path=${t.hcPath ?? '/'} scheme=${t.hcScheme ?? 'http'} interval=${t.hcInterval}ms timeout=${t.hcTimeout}ms`);
        console.log(`    healthy after ${t.hcHealthyThreshold} / unhealthy after ${t.hcUnhealthyThreshold} checks`);
      }
    }
    return;
  }

  let targetResources: Resource[] = resources;

  if (action === 'configure-some' || action === 'disable-some') {
    const verb = action === 'configure-some' ? 'configure' : 'disable';
    const selected = await checkbox<Resource>({
      message: `Select resources to ${verb} health checks on:`,
      choices: resources.map((r) => ({ name: r.name, value: r })),
      pageSize: 20,
      validate: (ans) => ans.length > 0 || 'Select at least one.',
    });
    targetResources = selected;
  }

  const enabling = action.startsWith('configure');

  if (enabling) {
    const hcPayload = await promptHcConfig();

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Apply to ${targetResources.length} resource(s)?`,
      default: false,
    }]);
    if (!confirm) { console.log('Aborted.'); return; }

    for (const r of targetResources) {
      const targets = await client.listTargets(r.resourceId);
      for (const t of targets) {
        const hcDefaults = hcPayload.hcEnabled ? { hcHostname: t.ip, hcPort: t.port } : {};
        await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, ...hcDefaults, ...hcPayload });
      }
      console.log(chalk.green(`  configured HC on: ${r.name}`));
    }
  } else {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Disable health checks on ${targetResources.length} resource(s)?`,
      default: false,
    }]);
    if (!confirm) { console.log('Aborted.'); return; }

    for (const r of targetResources) {
      const targets = await client.listTargets(r.resourceId);
      for (const t of targets) {
        await client.updateTarget(t.targetId, { siteId: t.siteId, ip: t.ip, port: t.port, hcEnabled: false });
      }
      console.log(chalk.yellow(`  disabled HC on: ${r.name}`));
    }
  }
}

async function promptHcConfig(): Promise<TargetUpdatePayload> {
  const { hcEnabled } = await inquirer.prompt([{
    type: 'confirm', name: 'hcEnabled', message: 'Enable health checks?', default: true,
  }]);

  if (!hcEnabled) return { hcEnabled: false };

  const { hcMode } = await inquirer.prompt([{
    type: 'list',
    name: 'hcMode',
    message: 'Check type:',
    choices: [
      { name: 'HTTP / HTTPS', value: 'http' },
      { name: 'TCP', value: 'tcp' },
    ],
  }]);

  const common = await inquirer.prompt([
    { type: 'input', name: 'hcInterval', message: 'Interval (seconds):', default: '10', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' },
    { type: 'input', name: 'hcTimeout', message: 'Timeout (seconds):', default: '5', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' },
    { type: 'input', name: 'hcHealthyThreshold', message: 'Healthy after N successes:', default: '2', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' },
    { type: 'input', name: 'hcUnhealthyThreshold', message: 'Unhealthy after N failures:', default: '3', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' },
  ]);

  const base: TargetUpdatePayload = {
    hcEnabled: true,
    hcMode,
    hcInterval: Number(common.hcInterval),
    hcTimeout: Number(common.hcTimeout),
    hcHealthyThreshold: Number(common.hcHealthyThreshold),
    hcUnhealthyThreshold: Number(common.hcUnhealthyThreshold),
  };

  if (hcMode === 'tcp') return base;

  const http = await inquirer.prompt([
    { type: 'list', name: 'hcScheme', message: 'Scheme:', choices: ['http', 'https'], default: 'http' },
    { type: 'input', name: 'hcPath', message: 'Path:', default: '/health' },
    { type: 'list', name: 'hcMethod', message: 'Method:', choices: ['GET', 'HEAD'], default: 'GET' },
    { type: 'input', name: 'hcStatus', message: 'Expected status code:', default: '200', validate: (v: string) => !isNaN(Number(v)) || 'Must be a number' },
    { type: 'confirm', name: 'hcFollowRedirects', message: 'Follow redirects?', default: false },
  ]);

  return {
    ...base,
    hcScheme: http.hcScheme,
    hcPath: http.hcPath,
    hcMethod: http.hcMethod,
    hcStatus: Number(http.hcStatus),
    hcFollowRedirects: http.hcFollowRedirects,
  };
}

async function fetchWithSpinner(msg: string): Promise<Resource[]> {
  process.stderr.write(chalk.dim(msg));
  const resources = await client.getAllResources();
  process.stderr.write('\r' + ' '.repeat(msg.length) + '\r');
  return resources;
}
