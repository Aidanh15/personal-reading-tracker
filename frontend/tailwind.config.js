/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Iowan Old Style', 'Baskerville', 'Times New Roman', 'serif'],
        mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f4f5f4', 100: '#e4e7e5', 200: '#c9cecb', 300: '#a6afa9',
          400: '#7d8982', 500: '#5f6b64', 600: '#4b554f', 700: '#3e4641',
          800: '#343a36', 900: '#292e2b', 950: '#161a18',
        },
        paper: { 50: '#fffdf7', 100: '#faf6ea', 200: '#f1ead9', 300: '#e5dac2' },
        copper: { 300: '#d8a77d', 400: '#c98754', 500: '#b46d3d', 600: '#955331', 700: '#793f2a' },
        sage: { 100: '#e1ece4', 500: '#5e8066', 600: '#496b53', 700: '#3c5745' },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      boxShadow: {
        card: '0 1px 2px rgb(22 26 24 / 0.04), 0 8px 30px rgb(22 26 24 / 0.06)',
        'card-hover': '0 16px 45px rgb(22 26 24 / 0.12)',
        book: '0 10px 24px rgb(22 26 24 / 0.24)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
