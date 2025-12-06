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
  private frames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
  private current = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private text: string;
  private startTimestamp: number | undefined;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    this.startTimestamp = Date.now();
    if (isCI) {
      console.log(`${colors.cyan}\u25CC${colors.reset} ${this.text}...`);
    } else {
      process.stdout.write(`${colors.cyan}${this.frames[0]}${colors.reset} ${this.text}`);
      this.interval = setInterval(() => {
        this.current = (this.current + 1) % this.frames.length;
        process.stdout.write(`\r${colors.cyan}${this.frames[this.current]}${colors.reset} ${this.text}`);
      }, 80);
    }
  }

  stop(success = true): void {
    let duration = 0;
    if (this.startTimestamp !== undefined) {
      duration = Date.now() - this.startTimestamp;
    }
    const durationStr = duration > 1000 ? ` ${colors.dim}(${formatDuration(duration)})${colors.reset}` : '';

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const icon = success ? `${colors.green}${icons.success}${colors.reset}` : `${colors.red}${icons.error}${colors.reset}`;

    if (isCI) {
      console.log(`${icon} ${this.text}${durationStr}`);
    } else {
      process.stdout.write(`\r${icon} ${this.text}${durationStr}\n`);
    }
  }

  update(text: string): void {
    this.text = text;
  }
}
