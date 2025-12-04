# Astro Orga

**Organization tools for Asso Info Evry** - Presentations, events, and more.

This repository contains tools for generating presentation materials, event assets, and other organizational content for the association.

## Features

- **Presentation Generator**: Create 4K presentation slides with QR codes, combine into PDF
- Designed for events like Nuit de l'Info
- Uses the association's design system (Cupertino font, color palette)

---

## Requirements

- **[Bun](https://bun.sh/)** runtime (v1.0+)
- **Python 3** with `fonttools` package (for font processing)

```bash
# Install Python dependencies
pip install fonttools brotli
```

---

## Setup

```bash
# Install dependencies
bun install
```

---

## Presentation Generator

Generate professional presentation slides and combine them into a single PDF.

### Usage

```bash
# Generate presentation
bun run generate

# With detailed progress output
bun run generate:verbose

# Show help
bun run generate -- --help
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--verbose, -v` | Show detailed progress during generation |
| `--font <path>` | Custom path to Cupertino font file |
| `--help, -h` | Show help message |

### Output

The generated presentation is saved to:
```
output/presentation.pdf
```

### Slides Generated

1. **Title Slide** - Association logo and name
2. **Discord** - QR code for event Discord server
3. **Nuit de l'Info** - QR code for the official NDI website
4. **Programme** - Event schedule with activities
5. **Escape Game** - Locked Up escape game promotion
6. **Association** - Association website QR code
7. **Sujet** - Link to download the event subject

### Font Configuration

The generator uses the Cupertino font from the astro-design submodule. By default, it looks for:
```
../astro-design/src/fonts/Cupertino-Pro-Full.woff2
```

If running outside of astro-maestro, specify the font path:
```bash
bun run generate --font /path/to/Cupertino-Pro-Full.woff2
```

---

## Assets

Place logo files in the `assets/` directory:

| File | Description |
|------|-------------|
| `AIE.png` | Association Info Evry logo |
| `lockedup.logo.png` | Locked Up escape game logo |

---

## Testing

```bash
# Run tests
bun run test
```

---

## Project Structure

```
astro-orga/
├── assets/                      # Logo files and images
│   ├── AIE.png
│   └── lockedup.logo.png
├── scripts/
│   └── generate-presentation.ts # Main presentation generator
├── src/
│   └── cli.ts                   # CLI utilities (colors, spinner)
├── tests/
│   └── generate-presentation.test.ts
├── output/                      # Generated files (gitignored)
│   └── presentation.pdf
├── .cache/                      # Font cache (gitignored)
├── package.json
└── README.md
```

---

## Customization

### Modifying Slides

Edit `scripts/generate-presentation.ts` to customize:

- **Colors**: Update the `COLORS` object
- **URLs**: Update `DISCORD_URL`, `NDI_URL`, `ASSO_URL`, etc.
- **Activities**: Modify `SCHEDULED_ACTIVITIES` and `MISC_ACTIVITIES` arrays
- **Slide content**: Modify the `slides` array in `generatePresentation()`

### Adding New Slides

1. Create a new slide generator function (see `generateTitleSlide` as example)
2. Add it to the `slides` array in `generatePresentation()`
3. The slide will automatically be included in the PDF

---

## How It Works

1. **Satori** renders React-like elements to SVG
2. **Resvg** converts SVG to high-resolution PNG (4K)
3. **pdf-lib** combines all PNGs into a single PDF
4. Temporary PNG files are cleaned up automatically

---

## Related Projects

- [astro-maestro](https://github.com/info-evry/astro-maestro) - Orchestrator for all Astro projects
- [astro-design](https://github.com/info-evry/astro-design) - Shared design system (fonts, colors)
- [astro-ndi](https://github.com/info-evry/astro-ndi) - Nuit de l'Info registration site

---
