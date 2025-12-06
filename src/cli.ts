/**
 * CLI Utilities for Astro Orga
 *
 * Provides colorful terminal output and spinners.
 */

export const isCI = !!(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.CIRCLECI ||
  process.env.JENKINS_URL
);

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

export const icons = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

export function header(text: string): void {
  const line = '\u2550'.repeat(text.length + 4);
  console.log(`\n${colors.cyan}\u2554${line}\u2557${colors.reset}`);
  console.log(`${colors.cyan}\u2551${colors.reset}  ${colors.bold}${text}${colors.reset}  ${colors.cyan}\u2551${colors.reset}`);
  console.log(`${colors.cyan}\u255A${line}\u255D${colors.reset}\n`);
}

export function success(text: string): void {
  console.log(`${colors.green}${icons.success}${colors.reset} ${text}`);
}

export function error(text: string): void {
  console.log(`${colors.red}${icons.error}${colors.reset} ${text}`);
}

export function warning(text: string): void {
  console.log(`${colors.yellow}${icons.warning}${colors.reset} ${text}`);
}

export function info(text: string): void {
  console.log(`${colors.blue}${icons.info}${colors.reset} ${text}`);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export class Spinner {
  private text: string;
  private startTimestamp: number | undefined;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    this.startTimestamp = Date.now();
    console.log(`${colors.cyan}\u25CB${colors.reset} ${this.text}...`);
  }

  stop(success = true): void {
    let duration = 0;
    if (this.startTimestamp !== undefined) {
      duration = Date.now() - this.startTimestamp;
    }
    const durationStr = duration > 1000 ? ` ${colors.dim}(${formatDuration(duration)})${colors.reset}` : '';
    const icon = success ? `${colors.green}${icons.success}${colors.reset}` : `${colors.red}${icons.error}${colors.reset}`;
    console.log(`${icon} ${this.text}${durationStr}`);
  }

  update(text: string): void {
    this.text = text;
  }
}
