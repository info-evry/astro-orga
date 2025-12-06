#!/usr/bin/env bun
/**
 * Presentation Generator for Asso Info Evry
 *
 * Generates presentation slides using Satori and combines them into a PDF.
 *
 * Run:
 *   bun run scripts/generate-presentation.ts
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, unlink, readFile } from 'node:fs/promises';
import QRCode from 'qrcode-svg';
import * as cli from '../src/cli';

// Support both Bun (import.meta.dir) and Node.js (import.meta.url)
const __dirname = typeof import.meta.dir === 'string'
  ? import.meta.dir
  : dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const ASSETS_DIR = resolve(ROOT_DIR, 'assets');
const LOGO_PATH = resolve(ASSETS_DIR, 'AIE.png');
const LOCKEDUP_LOGO_PATH = resolve(ASSETS_DIR, 'lockedup.logo.png');

// Slide dimensions (4K 16:9 presentation format)
const WIDTH = 3840;
const HEIGHT = 2160;

// Colors from the design system
const COLORS = {
  bg: '#000000',
  blue: '#2563eb',
  deepBlue: '#1e40af',
  indigo: '#4f46e5',
  cyan: '#0891b2',
  text: '#ffffff',
  textSecondary: '#a1a1a1',
};

// Association info
const ASSO_NAME = 'Asso Info Evry';
const DISCORD_URL = 'https://discord.gg/fxWsSSee';
const NDI_URL = 'https://www.nuitdelinfo.com/';
const ASSO_URL = 'https://asso.info-evry.fr';
const SUBJECT_URL = 'https://filesender.renater.fr/?s=download&token=1ee59758-cb41-400c-b6c2-47fc37e1804e';

// Controls how quickly orb opacity fades toward the edge
const ORB_GRADIENT_FADE = 0.4;

interface OrbConfig {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  width: string;
  height: string;
  color: string;
  opacity: number;
}

// Orb configuration for slides
const SLIDE_ORBS: OrbConfig[] = [
  { top: '-800px', right: '-400px', width: '2400px', height: '2400px', color: COLORS.blue, opacity: 28 },
  { bottom: '-1000px', left: '-600px', width: '2800px', height: '2800px', color: COLORS.deepBlue, opacity: 22 },
  { top: '40%', right: '15%', width: '1600px', height: '1600px', color: COLORS.indigo, opacity: 18 },
  { top: '-400px', left: '5%', width: '1400px', height: '1400px', color: COLORS.cyan, opacity: 14 },
];

// Activity schedule data
interface Activity {
  name: string;
  room: string;
  time: string;
}

const SCHEDULED_ACTIVITIES: Activity[] = [
  { name: 'Kahoot', room: 'Grand Amphi', time: '23:00' },
  { name: 'Kahoot', room: 'Grand Amphi', time: '00:00' },
];

interface MiscActivity {
  name: string;
  room: string;
}

const MISC_ACTIVITIES: MiscActivity[] = [
  { name: 'Escape Game', room: 'Salle 117' },
  { name: 'Console & Jeux de societe', room: 'Salle 111' },
  { name: 'Film', room: 'Grand Amphi' },
];

// Cache and output directories
const CACHE_DIR = resolve(ROOT_DIR, '.cache');
const OUTPUT_DIR = resolve(ROOT_DIR, 'output');
const SLIDES_DIR = resolve(OUTPUT_DIR, 'slides');

// Font weights
const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

function opacityToHex(opacity: number): string {
  const hex = Math.round((opacity / 100) * 255).toString(16);
  return hex.padStart(2, '0');
}

async function createSlideFont(inputPath: string, outputPath: string, weight: number): Promise<void> {
  const pythonScript = `
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont("${inputPath}")
if 'fvar' in font:
    instantiateVariableFont(font, {'wdth': 100, 'opsz': 28, 'wght': ${weight}}, inplace=True, overlap=True)

for table in ['MERG', 'meta', 'trak']:
    if table in font:
        del font[table]

font.flavor = None
font.save("${outputPath}")
`;

  const proc = Bun.spawn(['python3', '-c', pythonScript], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create static font at weight ${weight}: ${stderr}`);
  }
}

async function loadFonts(fontSourcePath: string): Promise<{ regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer }> {
  await mkdir(CACHE_DIR, { recursive: true });

  const regularPath = resolve(CACHE_DIR, 'Cupertino-OG-400.ttf');
  const mediumPath = resolve(CACHE_DIR, 'Cupertino-OG-500.ttf');
  const boldPath = resolve(CACHE_DIR, 'Cupertino-OG-700.ttf');

  const fontExists = async (path: string) => {
    try {
      await Bun.file(path).arrayBuffer();
      return true;
    } catch {
      return false;
    }
  };

  if (!await fontExists(regularPath)) {
    await createSlideFont(fontSourcePath, regularPath, FONT_WEIGHTS.regular);
  }
  if (!await fontExists(mediumPath)) {
    await createSlideFont(fontSourcePath, mediumPath, FONT_WEIGHTS.medium);
  }
  if (!await fontExists(boldPath)) {
    await createSlideFont(fontSourcePath, boldPath, FONT_WEIGHTS.bold);
  }

  const regular = await Bun.file(regularPath).arrayBuffer();
  const medium = await Bun.file(mediumPath).arrayBuffer();
  const bold = await Bun.file(boldPath).arrayBuffer();

  return { regular, medium, bold };
}

function generateOrbs(): object[] {
  return SLIDE_ORBS.map((orb) => {
    const style: Record<string, string | number> = {
      position: 'absolute',
      width: orb.width,
      height: orb.height,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${orb.color}${opacityToHex(orb.opacity)} 0%, ${orb.color}${opacityToHex(orb.opacity * ORB_GRADIENT_FADE)} 50%, transparent 75%)`,
    };
    if (orb.top !== undefined) style.top = orb.top;
    if (orb.bottom !== undefined) style.bottom = orb.bottom;
    if (orb.left !== undefined) style.left = orb.left;
    if (orb.right !== undefined) style.right = orb.right;

    return {
      type: 'div',
      props: { style },
    };
  });
}

function generateQRCode(url: string, size: number = 300): string {
  const qr = new QRCode({
    content: url,
    padding: 0,
    width: size,
    height: size,
    color: '#ffffff',
    background: 'transparent',
    ecl: 'M',
  });
  return qr.svg();
}

async function loadLogoDataUrl(): Promise<string> {
  const logoBuffer = await Bun.file(LOGO_PATH).arrayBuffer();
  const base64 = Buffer.from(logoBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

async function loadLockedUpLogoDataUrl(): Promise<string> {
  const logoBuffer = await Bun.file(LOCKEDUP_LOGO_PATH).arrayBuffer();
  const base64 = Buffer.from(logoBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

function createHeader(): object {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: '96px',
        left: '128px',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: COLORS.blue,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '56px',
              fontWeight: 500,
              color: COLORS.textSecondary,
              letterSpacing: '0.02em',
            },
            children: ASSO_NAME,
          },
        },
      ],
    },
  };
}

function createGrid(): object {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '160px 160px',
      },
    },
  };
}

async function generateTitleSlide(
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer },
  logoDataUrl: string
): Promise<string> {
  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        ...generateOrbs(),
        createGrid(),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '96px',
            },
            children: [
              {
                type: 'img',
                props: {
                  src: logoDataUrl,
                  width: 400,
                  height: 400,
                  style: { objectFit: 'contain' },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '240px',
                    fontWeight: 700,
                    color: COLORS.text,
                    textAlign: 'center',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                  },
                  children: ASSO_NAME,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '80px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    textAlign: 'center',
                  },
                  children: 'Association des Etudiants en Informatique',
                },
              },
            ],
          },
        },
      ],
    },
  };

  return await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Cupertino', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Cupertino', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Cupertino', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });
}

async function generateQRSlide(
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer },
  title: string,
  subtitle: string,
  url: string,
  showHeader: boolean = true
): Promise<string> {
  const qrSize = 800;
  const qrSvg = generateQRCode(url, qrSize);
  const qrBase64 = Buffer.from(qrSvg).toString('base64');
  const qrDataUrl = `data:image/svg+xml;base64,${qrBase64}`;

  const children: object[] = [
    ...generateOrbs(),
    createGrid(),
  ];

  if (showHeader) {
    children.push(createHeader());
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '240px',
        padding: '160px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '48px',
              maxWidth: '1400px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '176px',
                    fontWeight: 700,
                    color: COLORS.text,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '72px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    lineHeight: 1.4,
                  },
                  children: subtitle,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    marginTop: '32px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: COLORS.blue,
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '56px',
                          fontWeight: 500,
                          color: COLORS.cyan,
                        },
                        children: url.replace('https://', ''),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '48px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    backgroundColor: '#ffffff',
                    padding: '64px',
                    borderRadius: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  children: {
                    type: 'img',
                    props: {
                      src: qrDataUrl,
                      width: qrSize,
                      height: qrSize,
                      style: { filter: 'invert(1)' },
                    },
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    textAlign: 'center',
                  },
                  children: 'Scannez pour rejoindre',
                },
              },
            ],
          },
        },
      ],
    },
  });

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
      },
      children,
    },
  };

  return await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Cupertino', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Cupertino', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Cupertino', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });
}

function sortActivitiesByTime(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const [aHour] = a.time.split(':').map(Number);
    const [bHour] = b.time.split(':').map(Number);
    const aSort = aHour < 12 ? aHour + 24 : aHour;
    const bSort = bHour < 12 ? bHour + 24 : bHour;
    return aSort - bSort || a.time.localeCompare(b.time);
  });
}

async function generateActivitiesSlide(
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer }
): Promise<string> {
  const sortedActivities = sortActivitiesByTime(SCHEDULED_ACTIVITIES);

  const createActivityRow = (activity: Activity) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        paddingTop: '24px',
        paddingBottom: '24px',
        borderBottom: `2px solid ${COLORS.textSecondary}33`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: '56px',
              fontWeight: 700,
              color: COLORS.blue,
              width: '180px',
              flexShrink: 0,
            },
            children: activity.time,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flex: 1,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '52px',
                    fontWeight: 500,
                    color: COLORS.text,
                  },
                  children: activity.name,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '40px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                  },
                  children: activity.room,
                },
              },
            ],
          },
        },
      ],
    },
  });

  const createMiscItem = (activity: MiscActivity) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        paddingTop: '28px',
        paddingBottom: '28px',
        borderBottom: `2px solid ${COLORS.textSecondary}33`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: COLORS.cyan,
              flexShrink: 0,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '52px',
                    fontWeight: 500,
                    color: COLORS.text,
                  },
                  children: activity.name,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '40px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                  },
                  children: activity.room,
                },
              },
            ],
          },
        },
      ],
    },
  });

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        ...generateOrbs(),
        createGrid(),
        createHeader(),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '240px 128px 128px 128px',
              gap: '64px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '120px',
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: '-0.02em',
                  },
                  children: 'Programme de la Nuit',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '120px',
                    flex: 1,
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '64px',
                                fontWeight: 500,
                                color: COLORS.textSecondary,
                                marginBottom: '40px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              },
                              children: 'Planning',
                            },
                          },
                          ...sortedActivities.map(createActivityRow),
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '64px',
                                fontWeight: 500,
                                color: COLORS.textSecondary,
                                marginBottom: '40px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              },
                              children: 'Toute la nuit',
                            },
                          },
                          ...MISC_ACTIVITIES.map(createMiscItem),
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Cupertino', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Cupertino', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Cupertino', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });
}

async function generateEscapeGameSlide(
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer },
  lockedUpLogoDataUrl: string
): Promise<string> {
  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        ...generateOrbs(),
        createGrid(),
        createHeader(),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '160px',
              gap: '80px',
            },
            children: [
              {
                type: 'img',
                props: {
                  src: lockedUpLogoDataUrl,
                  width: 1200,
                  height: 400,
                  style: { objectFit: 'contain' },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '140px',
                    fontWeight: 700,
                    color: COLORS.text,
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                  },
                  children: 'Escape Game',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '40px',
                    marginTop: '40px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '32px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: COLORS.blue,
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '80px',
                                fontWeight: 500,
                                color: COLORS.text,
                              },
                              children: 'Salle 117',
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '56px',
                          fontWeight: 400,
                          color: COLORS.textSecondary,
                          textAlign: 'center',
                        },
                        children: 'Disponible toute la nuit',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Cupertino', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Cupertino', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Cupertino', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });
}

async function generateAssoSlide(
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer },
  logoDataUrl: string
): Promise<string> {
  const qrSize = 600;
  const qrSvg = generateQRCode(ASSO_URL, qrSize);
  const qrBase64 = Buffer.from(qrSvg).toString('base64');
  const qrDataUrl = `data:image/svg+xml;base64,${qrBase64}`;

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        ...generateOrbs(),
        createGrid(),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '160px',
              gap: '80px',
            },
            children: [
              {
                type: 'img',
                props: {
                  src: logoDataUrl,
                  width: 300,
                  height: 300,
                  style: { objectFit: 'contain' },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '140px',
                    fontWeight: 700,
                    color: COLORS.text,
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                  },
                  children: ASSO_NAME,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '64px',
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    textAlign: 'center',
                  },
                  children: 'Association des Etudiants en Informatique',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '40px',
                    marginTop: '40px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          backgroundColor: '#ffffff',
                          padding: '48px',
                          borderRadius: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        children: {
                          type: 'img',
                          props: {
                            src: qrDataUrl,
                            width: qrSize,
                            height: qrSize,
                            style: { filter: 'invert(1)' },
                          },
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '24px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: COLORS.blue,
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '56px',
                                fontWeight: 500,
                                color: COLORS.cyan,
                              },
                              children: 'asso.info-evry.fr',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  return await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Cupertino', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Cupertino', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Cupertino', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });
}

async function svgToPng(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: false },
  });

  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

async function generatePDF(pngPaths: string[], outputPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();

  for (const pngPath of pngPaths) {
    const pngBytes = await readFile(pngPath);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Create page with 16:9 aspect ratio (width x height in points)
    const pageWidth = 1920;
    const pageHeight = 1080;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  await Bun.write(outputPath, pdfBytes);
}

async function cleanupSlides(slidesDir: string): Promise<void> {
  try {
    const files = await readdir(slidesDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        await unlink(resolve(slidesDir, file));
      }
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }
}

export async function generatePresentation(verbose: boolean = false, fontPath?: string): Promise<boolean> {
  const spinner = new cli.Spinner('Generating presentation...');
  spinner.start();

  try {
    // Ensure output directories exist
    await mkdir(SLIDES_DIR, { recursive: true });

    // Find font source
    const fontSourcePath = fontPath || resolve(ROOT_DIR, '../astro-design/src/fonts/Cupertino-Pro-Full.woff2');

    try {
      await Bun.file(fontSourcePath).arrayBuffer();
    } catch {
      spinner.stop(false);
      cli.error(`Font not found at ${fontSourcePath}`);
      cli.info('Please provide font path using --font option or ensure astro-design submodule is available');
      return false;
    }

    // Load fonts and assets
    if (verbose) cli.info('Loading fonts and assets...');
    const fonts = await loadFonts(fontSourcePath);
    const logoDataUrl = await loadLogoDataUrl();
    const lockedUpLogoDataUrl = await loadLockedUpLogoDataUrl();

    // Define slides
    const slides = [
      { name: '01-title', generate: () => generateTitleSlide(fonts, logoDataUrl) },
      { name: '02-discord', generate: () => generateQRSlide(fonts, 'Discord', "Discord de l'evenement a Evry", DISCORD_URL, true) },
      { name: '03-nuitdelinfo', generate: () => generateQRSlide(fonts, "Nuit de l'Info", 'Site officiel - Inscription aux defis avant 21h', NDI_URL, true) },
      { name: '04-programme', generate: () => generateActivitiesSlide(fonts) },
      { name: '05-escape-game', generate: () => generateEscapeGameSlide(fonts, lockedUpLogoDataUrl) },
      { name: '06-asso', generate: () => generateAssoSlide(fonts, logoDataUrl) },
      { name: '07-sujet', generate: () => generateQRSlide(fonts, 'Sujet de la Nuit', "Telechargez le sujet officiel de l'evenement", SUBJECT_URL, true) },
    ];

    const pngPaths: string[] = [];

    // Generate each slide
    for (const slide of slides) {
      if (verbose) cli.info(`  Generating ${slide.name}...`);

      const svg = await slide.generate();
      const png = await svgToPng(svg);

      const outputPath = resolve(SLIDES_DIR, `${slide.name}.png`);
      await Bun.write(outputPath, png);
      pngPaths.push(outputPath);

      if (verbose) {
        const sizeKb = (png.length / 1024).toFixed(1);
        cli.success(`    Created ${slide.name}.png (${sizeKb} KB)`);
      }
    }

    // Generate PDF
    if (verbose) cli.info('Generating PDF...');
    const pdfPath = resolve(OUTPUT_DIR, 'presentation.pdf');
    await generatePDF(pngPaths, pdfPath);

    // Clean up PNG files
    if (verbose) cli.info('Cleaning up temporary PNG files...');
    await cleanupSlides(SLIDES_DIR);

    spinner.stop(true);
    cli.success(`Presentation generated: ${pdfPath}`);
    return true;
  } catch (error) {
    spinner.stop(false);
    cli.error(`Failed to generate presentation: ${error}`);
    return false;
  }
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const help = args.includes('--help') || args.includes('-h');

  // Parse --font option
  let fontPath: string | undefined;
  const fontIndex = args.indexOf('--font');
  if (fontIndex !== -1 && args[fontIndex + 1]) {
    fontPath = args[fontIndex + 1];
  }

  if (help) {
    console.log(`
${cli.colors.bold}Asso Info Evry Presentation Generator${cli.colors.reset}
Generate presentation slides and combine them into a PDF.

${cli.colors.bold}USAGE${cli.colors.reset}
  bun run scripts/generate-presentation.ts [options]

${cli.colors.bold}OPTIONS${cli.colors.reset}
  --verbose, -v    Show detailed output
  --font <path>    Path to Cupertino font file
  --help, -h       Show this help message

${cli.colors.bold}OUTPUT${cli.colors.reset}
  Creates output/presentation.pdf with all slides combined.
`);
    process.exit(0);
  }

  cli.header('Presentation Generator');

  const success = await generatePresentation(verbose, fontPath);

  if (!success) {
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    cli.error(`Presentation generation failed: ${error.message}`);
    process.exit(1);
  });
}
