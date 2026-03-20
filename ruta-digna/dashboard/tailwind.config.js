/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        success: '#16A34A',
        warning: '#D97706',
        neutral: '#F1F5F9',
        brand: { text: '#0F172A', muted: '#64748B' },
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'] },
    },
  },
  plugins: [],
}
