/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6', // Teal
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
        medical: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6', // Medical Blue
          700: '#1d4ed8',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', '"Tajawal"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
