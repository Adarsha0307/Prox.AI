import { Vibrant } from 'node-vibrant/browser';

export interface ExtractedPalette {
  primary: string | null;
  secondary: string | null;
  background: string | null;
  text: string | null;
}

export async function extractPaletteFromImage(imageUrl: string): Promise<ExtractedPalette> {
  try {
    const v = new Vibrant(imageUrl);
    const palette = await v.getPalette();
    
    // Node-vibrant returns LightVibrant, Vibrant, DarkVibrant, LightMuted, Muted, DarkMuted
    return {
      primary: palette.Vibrant?.hex || null,
      secondary: palette.Muted?.hex || null,
      background: palette.LightMuted?.hex || '#ffffff',
      text: palette.DarkVibrant?.hex || '#000000',
    };
  } catch (error) {
    console.error('Failed to extract palette:', error);
    return {
      primary: null,
      secondary: null,
      background: null,
      text: null,
    };
  }
}
