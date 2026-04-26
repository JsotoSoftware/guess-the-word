/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f2ff',
          200: '#b9e9ff',
          300: '#88ddff',
          400: '#51c9ff',
          500: '#27b1ff',
          600: '#0e8fe6',
          700: '#0e72b8',
          800: '#125f96',
          900: '#164f7c'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.05), 0 20px 40px rgba(15, 23, 42, 0.35)'
      }
    },
  },
  plugins: [],
}
