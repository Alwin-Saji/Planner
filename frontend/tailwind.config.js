/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        foreground: '#FFFFFF',
        surface: {
          DEFAULT: '#0C0C0C',
          elevated: '#141414',
          hover: '#1F1F1F',
          active: '#2A2A2A',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.12)',
          strong: 'rgba(255, 255, 255, 0.25)',
          active: 'rgba(255, 255, 255, 0.4)',
          subtle: 'rgba(255, 255, 255, 0.06)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A1A1AA',
          muted: '#71717A',
          disabled: '#52525B',
        },
      },
      fontFamily: {
        heading: ['Excon', 'Space Grotesk', 'sans-serif'],
        sans: ['Ranade', 'Inter', 'sans-serif'],
        body: ['Instrument Sans', 'Ranade', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        cursive: ['Caveat', 'cursive'],
      },
      spacing: {
        '18': '4.5rem',   // 72px - for extra large spacing
        '22': '5.5rem',   // 88px - for hero sections
      },
      borderRadius: {
        'sm': '0.5rem',   // 8px - small elements (buttons, badges)
        'md': '0.75rem',  // 12px - cards, inputs
        'lg': '1rem',     // 16px - large containers (rare use)
      },
      boxShadow: {
        'glow-white': '0 0 20px -5px rgba(255, 255, 255, 0.2)',
        'glass-card': '0 12px 32px 0 rgba(0, 0, 0, 0.7)',
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }], // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
      },
    },
  },
  plugins: [],
};
