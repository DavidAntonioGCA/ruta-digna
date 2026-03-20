/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
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
      borderRadius: { card: '16px', button: '10px', input: '8px' },
      boxShadow:    { card: '0 2px 12px rgba(0,0,0,0.08)' },
    },
  },
  plugins: [],
}
