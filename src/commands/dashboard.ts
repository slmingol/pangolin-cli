import chalk from 'chalk';
import readline from 'readline';
import { client } from '../api/client';
import { Resource, Target } from '../types';

const POLL_INTERVAL_MS = 10_000;

interface ResourceWithTargets {
  resource: Resource;
  targets: Target[];
}

function healthColor(status: string | undefined | null): string {
  switch (status) {
    case 'healthy':   return chalk.green('● healthy  ');
    case 'unhealthy': return chalk.red('● unhealthy');
    default:          return chalk.yellow('● unknown  ');
  }
}

function render(data: ResourceWithTargets[], lastUpdated: Date, error?: string) {
  const lines: string[] = [];

  lines.push(chalk.bold('Pangolin — Live Health Status') + chalk.dim(`   updated ${lastUpdated.toLocaleTimeString()}   q=quit r=refresh`));
  lines.push(chalk.dim('─'.repeat(80)));

  const withHc = data.filter(({ targets }) => targets.some((t) => t.hcEnabled));

  if (withHc.length === 0) {
    lines.push(chalk.dim('  No resources with health checks enabled.'));
  }

  for (const { resource, targets } of withHc) {
    const hcTargets = targets.filter((t) => t.hcEnabled && t.enabled !== false);
    lines.push(chalk.bold(`  ${resource.name}`));
    for (const t of hcTargets) {
      const hc = (t as Target & { hcHealth?: string }).hcHealth;
      const addr = `${t.ip}:${t.port}`.padEnd(30);
      const mode = (t.hcMode ?? 'http').padEnd(5);
      lines.push(`    ${healthColor(hc)}  ${addr} ${chalk.dim(mode)}`);
    }
  }

  lines.push(chalk.dim('─'.repeat(80)));

  const activeTargets = withHc.flatMap(d => d.targets).filter(t => t.hcEnabled && t.enabled !== false);
  const healthy   = activeTargets.filter(t => (t as any).hcHealth === 'healthy').length;
  const unhealthy = activeTargets.filter(t => (t as any).hcHealth === 'unhealthy').length;
  const unknown   = activeTargets.filter(t => (t as any).hcHealth !== 'healthy' && (t as any).hcHealth !== 'unhealthy').length;

  lines.push(
    chalk.green(`${healthy} healthy`) + '  ' +
    chalk.red(`${unhealthy} unhealthy`) + '  ' +
    chalk.yellow(`${unknown} unknown`)
  );

  if (error) lines.push(chalk.red(`\nError: ${error}`));

  return lines;
}

function clearLines(n: number) {
  for (let i = 0; i < n; i++) process.stdout.write('\x1B[1A\x1B[2K');
}

export async function runDashboard() {
  process.stdout.write('\x1B[?25l'); // hide cursor
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  let lastLines: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = true;

  function draw(lines: string[]) {
    if (lastLines.length > 0) clearLines(lastLines.length);
    lines.forEach((l) => process.stdout.write(l + '\n'));
    lastLines = lines;
  }

  async function refresh() {
    try {
      const resources = await client.getAllResources();
      const data: ResourceWithTargets[] = await Promise.all(
        resources.map(async (r) => ({
          resource: r,
          targets: await client.listTargets(r.resourceId),
        }))
      );
      draw(render(data, new Date()));
    } catch (err) {
      draw(render([], new Date(), err instanceof Error ? err.message : String(err)));
    }

    if (running) timer = setTimeout(refresh, POLL_INTERVAL_MS);
  }

  process.stdin.on('keypress', (_, key) => {
    if (!key) return;
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      running = false;
      if (timer) clearTimeout(timer);
      if (lastLines.length) clearLines(lastLines.length);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write('\x1B[?25h');
      process.exit(0);
    }
    if (key.name === 'r') {
      if (timer) clearTimeout(timer);
      refresh();
    }
  });

  // initial loading indicator
  process.stdout.write(chalk.dim('Fetching...\n'));
  lastLines = [''];
  await refresh();
}
