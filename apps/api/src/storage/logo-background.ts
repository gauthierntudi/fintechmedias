import sharp from 'sharp';

const SIZE = 64;
/** Écart max (distance RVB) pour considérer un pixel « de la même couleur ». */
const TOLERANCE = 42;
/** Part minimale de la bordure qui doit partager cette couleur. */
const MIN_SHARE = 0.6;

/**
 * Couleur de fond d’un logo, lue sur sa bordure (2 px de pourtour).
 * Renvoie `#rrggbb` si la bordure est majoritairement d’une seule couleur
 * opaque ; `null` si elle est transparente ou hétérogène (fond blanc par défaut).
 */
export async function detectLogoBackground(
  input: Buffer,
): Promise<string | null> {
  try {
    const { data, info } = await sharp(input)
      .resize(SIZE, SIZE, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const border: [number, number, number][] = [];
    let transparent = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const edge =
          x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2;
        if (!edge) continue;
        const i = (y * info.width + x) * info.channels;
        if (data[i + 3] < 200) {
          transparent++;
          continue;
        }
        border.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
    const total = border.length + transparent;
    // Logo détouré : le fond blanc par défaut convient.
    if (!total || transparent / total > 0.4) return null;

    // Médiane par canal = couleur dominante robuste aux quelques pixels du logo.
    const median = (k: 0 | 1 | 2) => {
      const values = border.map((p) => p[k]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    const color: [number, number, number] = [median(0), median(1), median(2)];
    const close = border.filter(
      (p) =>
        Math.hypot(p[0] - color[0], p[1] - color[1], p[2] - color[2]) <=
        TOLERANCE,
    ).length;
    if (close / total < MIN_SHARE) return null;

    // Bordure (quasi) blanche : rien à changer.
    if (color.every((c) => c >= 245)) return null;

    return `#${color.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return null;
  }
}
