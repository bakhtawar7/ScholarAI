/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Full indigo ramp.
         *
         * The previous palette defined only 50/100/500/600/700/900, but the app uses
         * brand-300, brand-400, brand-800 and brand-950 in ~66 places. Tailwind only
         * emits classes for defined shades, so every one of those utilities was a
         * no-op — accent text fell back to the inherited colour and gradients lost a
         * stop. Defining the whole ramp makes those existing classes render.
         */
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#1e1b4b',
          950: '#141033',
        },
        dark: {
          bg: '#0b0f17',
          card: '#131926',
          border: '#1f293d',
          hover: '#1a2234',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
