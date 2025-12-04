# Astro Orga

Organization tools for Asso Info Evry - presentations, events, and more.

## Requirements

- [Bun](https://bun.sh/) runtime
- Python 3 with `fonttools` package (for font processing)

```bash
pip install fonttools brotli
```

## Setup

```bash
bun install
```

## Generate Presentation

Generates presentation slides and combines them into a single PDF.

```bash
bun run generate
```

### Options

- `--verbose, -v` - Show detailed progress
- `--font <path>` - Custom path to Cupertino font file
- `--help, -h` - Show help

### Font Configuration

The script requires access to the Cupertino font. By default, it looks for:
- `../astro-design/src/fonts/Cupertino-Pro-Full.woff2`

If you're running this outside of astro-maestro, use the `--font` option:

```bash
bun run generate --font /path/to/Cupertino-Pro-Full.woff2
```

## Output

The generated presentation PDF is saved to:
- `output/presentation.pdf`

## Assets

Place your logo files in the `assets/` directory:
- `AIE.png` - Association logo
- `lockedup.logo.png` - Locked Up escape game logo
