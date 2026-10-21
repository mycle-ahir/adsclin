import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          neon: '#00ff88',
          emerald: '#10b981',
          teal: '#14b8a6',
          dark: '#040807',
          blue: '#10b981',
          'blue-hover': '#059669',
          'blue-light': '#34d399',
        },
        cyber: {
          bg: '#040807',
          sidebar: '#060f0b',
          card: '#08140f',
          panel: '#0b1d16',
          surface: '#0f261d',
          input: '#091812',
          border: '#14382a',
          'border-bright': '#1b4a37',
          neon: '#00ff88',
          'neon-dim': '#0dfd8e',
          text: '#e2f9ed',
          muted: '#527967',
        },
        dark: {
          bg: '#040807',
          sidebar: '#060f0b',
          card: '#08140f',
          panel: '#0b1d16',
          input: '#091812',
          border: '#14382a',
          'border-light': '#1b4a37',
        },
      },
      boxShadow: {
        'neon-sm': '0 0 8px rgba(0, 255, 136, 0.3)',
        'neon-md': '0 0 16px rgba(0, 255, 136, 0.4)',
        'neon-lg': '0 0 25px rgba(0, 255, 136, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
