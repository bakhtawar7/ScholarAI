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
      /**
       * Type scale.
       *
       * The interface had drifted very small: ~250 uses of `text-xs` and 90 of the
       * arbitrary `text-[11px]`, against only ~70 uses of `text-sm`/`text-base`
       * combined — so almost all body copy rendered at 11–12px. Dense small text reads
       * as "data-heavy" but is genuinely hard to read and is the giveaway of a layout
       * that was never looked at on a real screen.
       *
       * Rather than rewrite hundreds of call sites, the scale itself is redefined: the
       * floor moves up and line-heights get room to breathe. `2xs` exists for genuine
       * micro-labels (table captions, badge text) and replaces the arbitrary
       * `text-[11px]`, so nothing escapes the scale.
       */
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.05rem' }], // 12px — micro-labels only
        xs: ['0.8125rem', { lineHeight: '1.2rem' }], // 13px — was 12px
        sm: ['0.9375rem', { lineHeight: '1.45rem' }], // 15px — was 14px
        base: ['1rem', { lineHeight: '1.6rem' }],
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
