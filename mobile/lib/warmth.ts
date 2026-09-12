// Node opacity/saturation = warmth (0 = dim grey, 1 = full color). Backend
// computes the actual value (backend/README.md §4) — this only maps it to
// a color for the map.
export function warmthColor(warmth: number): string {
  const grey = [156, 163, 175]; // gray-400
  const warm = [249, 115, 22]; // orange-500
  const t = Math.max(0, Math.min(1, warmth));
  const rgb = grey.map((g, i) => Math.round(g + (warm[i] - g) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function warmthOpacity(warmth: number): number {
  return 0.35 + 0.65 * Math.max(0, Math.min(1, warmth));
}
