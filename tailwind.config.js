/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/**/*.html',
    './frontend/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0a0a2e',
        'dark-purple': '#1a1a3e',
        lavender: '#a78bfa',
        gold: '#fbbf24',
        softgreen: '#86efac',
        softred: '#fca5a5',
      },
      fontFamily: {
        serif: ['Noto Serif KR', 'serif'],
        sans: ['Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
