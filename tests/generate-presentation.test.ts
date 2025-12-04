import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, rm, readdir, stat } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT_DIR, 'output');
const ASSETS_DIR = resolve(ROOT_DIR, 'assets');

describe('Presentation Generator', () => {
  describe('Assets', () => {
    it('should have AIE logo in assets', async () => {
      const logoPath = resolve(ASSETS_DIR, 'AIE.png');
      const logoStat = await stat(logoPath);
      expect(logoStat.isFile()).toBe(true);
      expect(logoStat.size).toBeGreaterThan(0);
    });

    it('should have Locked Up logo in assets', async () => {
      const logoPath = resolve(ASSETS_DIR, 'lockedup.logo.png');
      const logoStat = await stat(logoPath);
      expect(logoStat.isFile()).toBe(true);
      expect(logoStat.size).toBeGreaterThan(0);
    });
  });

  describe('CLI Module', () => {
    it('should export Spinner class', async () => {
      const cli = await import('../src/cli');
      expect(cli.Spinner).toBeDefined();
      expect(typeof cli.Spinner).toBe('function');
    });

    it('should export logging functions', async () => {
      const cli = await import('../src/cli');
      expect(typeof cli.success).toBe('function');
      expect(typeof cli.error).toBe('function');
      expect(typeof cli.info).toBe('function');
      expect(typeof cli.warning).toBe('function');
      expect(typeof cli.header).toBe('function');
    });

    it('should detect CI environment', async () => {
      const cli = await import('../src/cli');
      expect(typeof cli.isCI).toBe('boolean');
    });
  });

  describe('Generation Script', () => {
    it('should export generatePresentation function', async () => {
      const { generatePresentation } = await import('../scripts/generate-presentation');
      expect(typeof generatePresentation).toBe('function');
    });
  });

  describe('PDF Generation (Integration)', () => {
    const testOutputDir = resolve(ROOT_DIR, 'output-test');

    beforeAll(async () => {
      await mkdir(testOutputDir, { recursive: true });
    });

    afterAll(async () => {
      try {
        await rm(testOutputDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should have pdf-lib installed', async () => {
      const { PDFDocument } = await import('pdf-lib');
      expect(PDFDocument).toBeDefined();
      expect(typeof PDFDocument.create).toBe('function');
    });

    it('should have satori installed', async () => {
      const satori = await import('satori');
      expect(satori.default).toBeDefined();
    });

    it('should have resvg installed', async () => {
      const { Resvg } = await import('@resvg/resvg-js');
      expect(Resvg).toBeDefined();
    });

    it('should have qrcode-svg installed', async () => {
      const QRCode = await import('qrcode-svg');
      expect(QRCode.default).toBeDefined();
    });
  });
});
