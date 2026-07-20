/** Classic SHIORI polaroid / camera theme tokens (theme_id = 'classic'). */

export const classicTheme = {
  id: 'classic' as const,
  frame: {
    color: '#F5EFE0',
    ink: '#4A3B2A',
    width: 1200,
    height: 1800,
    photoWidth: 1080,
    photoHeight: 1440,
    margin: 60,
  },
  camera: {
    bodyGradient: 'linear-gradient(180deg, #ffffff 0%, #f5f6f7 100%)',
    finderShell: '#f5efe0',
    chargeDot: '#d6602a',
  },
} as const

export type ClassicTheme = typeof classicTheme
