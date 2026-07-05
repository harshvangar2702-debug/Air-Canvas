/**
 * Inline SVG icons (Lucide-style, MIT-licensed path data), stroked with
 * `currentColor` so CSS controls their color. `icon(name)` returns a ready-to-
 * inject <svg> string; the HUD sets it as a button's innerHTML for a clean,
 * professional look instead of emoji.
 */

// Inner markup (paths/shapes) per icon; wrapped by `icon()` below.
const PATHS: Record<string, string> = {
  // Tools
  pencil:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  line: '<path d="M5 19 19 5"/>',
  rectangle: '<rect x="3" y="6" width="18" height="12" rx="1"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="10" ry="6"/>',
  triangle: '<path d="M12 3 22 20H2Z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  // Actions
  eraser:
    '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 12 6 6"/>',
  gravity: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/><path d="M5 21h14"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  // Pen styles (M12)
  penSolid: '<path d="M4 18 18 4a2 2 0 0 1 2 2L6 20l-3 1Z"/>',
  penGlow: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  penMarker: '<path d="M9 11 4 16v4h4l5-5"/><path d="m13 7 4 4"/><path d="M14 4h6v6"/>',
  penDashed: '<path d="M5 12h3"/><path d="M11 12h3"/><path d="M17 12h3"/>',
  penCalligraphy: '<path d="M3 20c4-1 6-3 9-9s5-8 9-9"/>',
  // Mode notice
  cube:
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  pencilTip:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
};

/** Return a full <svg> string for the named icon, sized `size` px. */
export function icon(name: keyof typeof PATHS | string, size = 20): string {
  const inner = PATHS[name] ?? '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  );
}
