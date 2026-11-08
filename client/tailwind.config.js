/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          950: 'var(--brand-950)',
        },
        gold: { 100: 'var(--gold-100)', 500: 'var(--gold-500)' },
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        border: 'var(--border)',
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        muted: 'var(--muted)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        stnon: 'var(--st-non)',
        stnonbg: 'var(--st-non-bg)',
        stcours: 'var(--st-cours)',
        stcoursbg: 'var(--st-cours-bg)',
        straite: 'var(--st-traite)',
        straitebg: 'var(--st-traite-bg)',
      },
      borderRadius: {
        sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)',
      },
      transitionTimingFunction: { ease: 'var(--ease)' },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
        arabic: ['Cairo', 'Inter Variable', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
