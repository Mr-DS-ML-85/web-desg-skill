#!/usr/bin/env node
// design-tokens.mjs — Extract design tokens (colors, typography, spacing,
// radii, shadows, breakpoints, container) from a scrape directory.
// Output: a single design-tokens.json suitable for use as CSS custom properties.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function parseArgs(argv) {
  const args = { scrapeDir: null, out: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--scrape-dir': args.scrapeDir = next(); break;
      case '--out': args.out = next(); break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (a.startsWith('--')) { console.error(`Unknown: ${a}`); process.exit(2); }
        if (!args.scrapeDir) args.scrapeDir = a;
    }
  }
  return args;
}

function help() {
  console.log(`Usage: design-tokens.mjs --scrape-dir <dir> [--out <file>]

Reads colors.json, styles.css, inline-styles.css, dom.html from <dir> and
extracts structured design tokens. Outputs JSON to stdout, or to --out.
`);
}

// ---------- Helpers ----------
function readText(dir, name) {
  const p = join(dir, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function readJson(dir, name, fallback) {
  const p = join(dir, name);
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}

// Convert any color string to a normalized hex
function toHex(color) {
  if (!color) return null;
  color = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return '#' + color.slice(1).split('').map(c => c + c).join('');
  }
  if (/^#[0-9a-f]{8}$/.test(color)) return color.slice(0, 7); // strip alpha
  const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [r, g, b] = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number);
    return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  const namedMap = {
    red: '#ff0000', green: '#008000', blue: '#0000ff', black: '#000000',
    white: '#ffffff', gray: '#808080', grey: '#808080', yellow: '#ffff00',
    orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
    cyan: '#00ffff', magenta: '#ff00ff', silver: '#c0c0c0', gold: '#ffd700',
  };
  if (namedMap[color]) return namedMap[color];
  return null;
}

function luminance(hex) {
  if (!hex || !/^#[0-9a-f]{6}$/.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function isLight(hex) { return luminance(hex) > 0.5; }

// Extract all colors from CSS, ranked by frequency
function extractColorPalette(css, colorsJson) {
  // Use colors.json if available (already extracted by scrape-site.mjs)
  const source = colorsJson?.colors || [];
  const ranked = source
    .map(c => ({ hex: toHex(c.hex), frequency: c.frequency, raw: c.hex }))
    .filter(c => c.hex)
    .filter(c => c.hex !== '#000000' && c.hex !== '#ffffff'); // drop pure black/white noise

  // Dedupe by hex, sum frequency
  const map = new Map();
  for (const c of ranked) {
    if (!map.has(c.hex)) map.set(c.hex, { hex: c.hex, frequency: 0, raws: [] });
    const e = map.get(c.hex);
    e.frequency += c.frequency;
    e.raws.push(c.raw);
  }
  return [...map.values()].sort((a, b) => b.frequency - a.frequency);
}

// Find the brand color: heuristics
// 1. Look for colors used in `:hover` rules on `a` tags (often brand)
// 2. Look for `button { background: X }` or `.btn { background: X }`
// 3. Resolve `var(--brand)` / `var(--color-primary)` style refs
// 4. Look for colors with high saturation and medium frequency
function findBrandColor(css, palette) {
  // Build CSS variable map for resolving var() in background/color values
  const cssVars = new Map();
  const varRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
  let vm;
  while ((vm = varRe.exec(css)) !== null) {
    cssVars.set(vm[1].trim(), vm[2].trim());
  }
  const resolveVar = (val) => {
    val = val.trim();
    const varMatch = val.match(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/);
    if (varMatch) {
      const fallback = varMatch[2]?.trim();
      const resolved = cssVars.get(varMatch[1]);
      // Recursive resolution (in case var points to another var)
      if (resolved && resolved.startsWith('var(')) return resolveVar(resolved);
      return resolved || fallback || val;
    }
    return val;
  };

  // Look for --brand / --primary / --accent variable definitions
  const brandVarNames = ['--brand', '--brand-color', '--color-brand', '--color-primary',
                         '--primary', '--accent', '--vp-c-brand-1', '--vp-c-brand'];
  for (const name of brandVarNames) {
    if (cssVars.has(name)) {
      const hex = toHex(resolveVar(cssVars.get(name)));
      if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
    }
  }

  // Try button/link backgrounds (resolving var() if needed)
  const buttonBgMatch = css.match(/(?:button|\.btn|\.button|\.cta|a\.button)[^{]*\{[^}]*background(?:-color)?\s*:\s*([^;)}]+)/i);
  if (buttonBgMatch) {
    const resolved = resolveVar(buttonBgMatch[1]);
    const hex = toHex(resolved);
    if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
  }
  const linkColorMatch = css.match(/(?:^|[\s,])a\b[^{]*\{[^}]*color\s*:\s*([^;)}]+)/im);
  if (linkColorMatch) {
    const resolved = resolveVar(linkColorMatch[1]);
    const hex = toHex(resolved);
    if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
  }
  // Fall back: most frequent saturated color
  for (const c of palette) {
    if (c.hex === '#ffffff' || c.hex === '#000000') continue;
    const r = parseInt(c.hex.slice(1, 3), 16);
    const g = parseInt(c.hex.slice(3, 5), 16);
    const b = parseInt(c.hex.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation > 0.4) return c.hex;
  }
  return palette[0]?.hex || '#3B82F6';
}

// Find typography: most-used font families + heading sizes
function extractTypography(css, html) {
  // Build a map of CSS variables (for resolving var(--font-*) in font-family)
  const cssVars = new Map();
  const varRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
  let vm;
  while ((vm = varRe.exec(css)) !== null) {
    cssVars.set(vm[1].trim(), vm[2].trim());
  }
  const resolveVar = (val) => {
    val = val.trim();
    const varMatch = val.match(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/);
    if (varMatch) {
      const fallback = varMatch[2]?.trim();
      return cssVars.get(varMatch[1]) || fallback || val;
    }
    return val;
  };

  // Font family frequencies
  const families = new Map();
  const famRe = /font-family\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = famRe.exec(css)) !== null) {
    let fam = resolveVar(m[1]);
    // Take the first family in the stack (the preferred one)
    fam = fam.trim().replace(/['"]/g, '').split(',')[0].trim();
    // Skip generic system-ui / sans-serif unless it's the only thing
    if (!fam || /^(inherit|initial|unset|revert)$/i.test(fam)) continue;
    families.set(fam, (families.get(fam) || 0) + 1);
  }
  const sortedFamilies = [...families.entries()].sort((a, b) => b[1] - a[1]);

  // Body font = most frequent
  const bodyFont = sortedFamilies[0]?.[0] || 'system-ui, sans-serif';
  // Heading font = second-most frequent (often different), or same as body
  const headingFont = sortedFamilies[1]?.[0] || bodyFont;
  // Mono font — look for one with mono in the name
  const monoMatch = sortedFamilies.find(([f]) => /mono|courier|consolas|menlo|jetbrains|fira\s*code/i.test(f));
  const monoFont = monoMatch?.[0] || 'ui-monospace, monospace';

  // Heading scale: extract h1..h6 font-sizes
  const scale = {};
  for (let i = 1; i <= 6; i++) {
    const re = new RegExp(`h${i}\\s*\\{[^}]*font-size\\s*:\\s*([^;}]+)`, 'i');
    const match = css.match(re);
    if (match) scale[`h${i}`] = match[1].trim();
  }

  // Body size + line-height
  const bodyMatch = css.match(/body\s*\{[^}]*font-size\s*:\s*([^;}]+)/i);
  const bodySize = bodyMatch?.[1]?.trim() || '16px';
  const lhMatch = css.match(/body\s*\{[^}]*line-height\s*:\s*([^;}]+)/i);
  const bodyLh = lhMatch?.[1]?.trim() || '1.5';

  // Heading weights
  const weights = new Set();
  const weightRe = /font-weight\s*:\s*(bold|\d+)/gi;
  while ((m = weightRe.exec(css)) !== null) {
    const w = m[1].toLowerCase() === 'bold' ? '700' : m[1];
    weights.add(w);
  }

  return {
    heading: { family: headingFont, weights: [...weights].sort(), scale },
    body: { family: bodyFont, weight: '400', size: bodySize, lineHeight: bodyLh },
    mono: { family: monoFont },
    allFamilies: sortedFamilies.slice(0, 5).map(([f, count]) => ({ family: f, count })),
  };
}

// Spacing scale: extract commonly-used padding/margin values
function extractSpacing(css) {
  const values = new Map();
  const re = /(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const val = m[1].trim();
    // Skip 0, auto, inherit, calc()
    if (/^(0|auto|inherit|initial|var\(--|calc\()/.test(val)) continue;
    values.set(val, (values.get(val) || 0) + 1);
  }
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    scale: sorted.map(([v]) => v),
    unit: sorted[0]?.[0]?.match(/rem|em|px/)?.[0] || 'rem',
    raw: sorted.map(([val, count]) => ({ value: val, count })),
  };
}

// Radii
function extractRadii(css) {
  const values = new Map();
  const re = /border-radius\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const val = m[1].trim();
    if (/^(0|inherit|initial)/.test(val)) continue;
    values.set(val, (values.get(val) || 0) + 1);
  }
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]);
  return {
    sm: sorted[2]?.[0] || '0.25rem',
    md: sorted[1]?.[0] || '0.5rem',
    lg: sorted[0]?.[0] || '0.75rem',
    full: '9999px',
    raw: sorted.slice(0, 5).map(([val, count]) => ({ value: val, count })),
  };
}

// Shadows
function extractShadows(css) {
  const shadows = new Map();
  const re = /box-shadow\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const val = m[1].trim();
    if (val === 'none') continue;
    shadows.set(val, (shadows.get(val) || 0) + 1);
  }
  const sorted = [...shadows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const names = ['sm', 'md', 'lg', 'xl', '2xl'];
  return sorted.map(([value, count], i) => ({ name: names[i] || `s${i}`, value, count }));
}

// Breakpoints (from @media queries)
function extractBreakpoints(css) {
  const bps = new Map();
  const re = /@media\s*\([^)]*min-width\s*:\s*(\d+px)\)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    bps.set(m[1], (bps.get(m[1]) || 0) + 1);
  }
  const sorted = [...bps.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const named = ['sm', 'md', 'lg', 'xl', '2xl'];
  const out = {};
  sorted.slice(0, 5).forEach(([val], i) => { out[named[i] || `bp${i}`] = val; });
  return out;
}

// Container
function extractContainer(css) {
  const containerMatch = css.match(/\.(?:container|wrapper|max-w-[a-z]+)\s*\{[^}]*max-width\s*:\s*([^;}]+)/i);
  const paddingMatch = css.match(/\.(?:container|wrapper)\s*\{[^}]*padding(?:-left|-inline)?\s*:\s*([^;}]+)/i);
  return {
    maxWidth: containerMatch?.[1]?.trim() || '1200px',
    padding: paddingMatch?.[1]?.trim() || '1.5rem',
  };
}

// Categorize palette into semantic roles
function categorizeColors(palette, brandColor, css) {
  // Compute saturation + luminance for each color so we can distinguish grays
  // from chromatic colors and pick semantic roles sensibly.
  const withSat = palette.map(c => {
    const r = parseInt(c.hex.slice(1, 3), 16);
    const g = parseInt(c.hex.slice(3, 5), 16);
    const b = parseInt(c.hex.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return { ...c, saturation, luminance: luminance(c.hex), r, g, b };
  });

  // Background = lightest low-saturation color (or white if none)
  const lightGrays = withSat.filter(c => c.saturation < 0.1 && c.luminance > 0.85 && c.luminance < 0.99);
  const background = {
    default: lightGrays[0]?.hex || '#FFFFFF',
    muted: lightGrays[1]?.hex || lightGrays[0]?.hex || '#F9FAFB',
  };

  // Text = darkest low-saturation colors (grays/blacks, NOT saturated colors)
  const darkGrays = withSat
    .filter(c => c.saturation < 0.3 && c.luminance < 0.3)
    .sort((a, b) => a.luminance - b.luminance);
  const text = {
    primary: darkGrays[0]?.hex || '#111827',
    secondary: darkGrays[1]?.hex || '#6B7280',
  };

  // Border = mid-luminance low-saturation gray
  const borders = withSat.filter(c => {
    return c.saturation < 0.15 && c.luminance > 0.7 && c.luminance < 0.97;
  }).sort((a, b) => Math.abs(a.luminance - 0.88) - Math.abs(b.luminance - 0.88));
  const border = borders[0]?.hex || '#E5E7EB';

  // Accent: a saturated color that's not the brand
  const saturated = withSat.filter(c => c.saturation > 0.5 && c.hex !== brandColor);
  const accent = saturated[0]?.hex || brandColor;

  return {
    brand: brandColor,
    primary: brandColor,
    background,
    text,
    border,
    accent,
    palette: withSat.slice(0, 20).map(c => ({
      hex: c.hex,
      frequency: c.frequency,
      luminance: parseFloat(c.luminance.toFixed(3)),
      saturation: parseFloat(c.saturation.toFixed(3)),
    })),
  };
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.scrapeDir) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  const dir = resolve(args.scrapeDir);
  const css = readText(dir, 'styles.css') + '\n' + readText(dir, 'inline-styles.css');
  const html = readText(dir, 'dom.html');
  const colorsJson = readJson(dir, 'colors.json', { colors: [] });

  const palette = extractColorPalette(css, colorsJson);
  const brandColor = findBrandColor(css, palette);
  const colors = categorizeColors(palette, brandColor, css);
  const typography = extractTypography(css, html);
  const spacing = extractSpacing(css);
  const radii = extractRadii(css);
  const shadows = extractShadows(css);
  const breakpoints = extractBreakpoints(css);
  const container = extractContainer(css);

  const tokens = {
    sourceScrapeDir: dir,
    extractedAt: new Date().toISOString(),
    colors,
    typography,
    spacing,
    radii,
    shadows,
    breakpoints,
    container,
    // CSS custom property form — drop straight into :root
    cssVariables: generateCssVars({ colors, typography, spacing, radii, shadows, breakpoints, container }),
  };

  const out = JSON.stringify(tokens, null, 2);
  if (args.out) {
    writeFileSync(args.out, out);
    console.log(`Wrote ${args.out}`);
  } else {
    console.log(out);
  }
}

function generateCssVars({ colors, typography, spacing, radii, shadows, breakpoints, container }) {
  const lines = [
    `:root {`,
    `  /* Colors */`,
    `  --color-brand: ${colors.brand};`,
    `  --color-primary: ${colors.primary};`,
    `  --color-accent: ${colors.accent};`,
    `  --color-bg: ${colors.background.default};`,
    `  --color-bg-muted: ${colors.background.muted};`,
    `  --color-text: ${colors.text.primary};`,
    `  --color-text-muted: ${colors.text.secondary};`,
    `  --color-border: ${colors.border};`,
    ``,
    `  /* Typography */`,
    `  --font-heading: ${typography.heading.family};`,
    `  --font-body: ${typography.body.family};`,
    `  --font-mono: ${typography.mono.family};`,
    `  --font-size-body: ${typography.body.size};`,
    `  --line-height-body: ${typography.body.lineHeight};`,
    ...Object.entries(typography.heading.scale).map(([k, v]) => `  --font-size-${k}: ${v};`),
    ``,
    `  /* Spacing */`,
    ...spacing.scale.map((v, i) => `  --space-${i}: ${v};`),
    ``,
    `  /* Radii */`,
    `  --radius-sm: ${radii.sm};`,
    `  --radius-md: ${radii.md};`,
    `  --radius-lg: ${radii.lg};`,
    `  --radius-full: ${radii.full};`,
    ``,
    `  /* Shadows */`,
    ...shadows.map(s => `  --shadow-${s.name}: ${s.value};`),
    ``,
    `  /* Breakpoints */`,
    ...Object.entries(breakpoints).map(([k, v]) => `  --bp-${k}: ${v};`),
    ``,
    `  /* Container */`,
    `  --container-max: ${container.maxWidth};`,
    `  --container-padding: ${container.padding};`,
    `}`,
  ];
  return lines.join('\n');
}

main();
