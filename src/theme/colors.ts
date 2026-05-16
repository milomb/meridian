export const colors = {
  bg: '#0D0C0B',
  surface: '#1A1917',
  surfaceAlt: '#242220',
  border: '#2A2825',
  primary: '#D4A574',
  primaryDim: '#A67C52',
  primaryFaint: '#3A2A1A',
  text: '#F0EDE8',
  textSecondary: '#8A857E',
  textMuted: '#4A4540',
  error: '#E05C5C',
  success: '#6DB87A',
  warning: '#D4A574',

  categories: {
    work: '#5B8FD4',
    training: '#6DB87A',
    personal: '#D4A574',
    rest: '#9B8FD4',
    nutrition: '#D47A5B',
    learning: '#5BD4C8',
  },

  categoryBg: {
    work: '#1A2A3A',
    training: '#1A2A1E',
    personal: '#2A1E10',
    rest: '#231E2A',
    nutrition: '#2A1E18',
    learning: '#1A2A2A',
  },
} as const;

export type Category = 'work' | 'training' | 'personal' | 'rest' | 'nutrition' | 'learning';
