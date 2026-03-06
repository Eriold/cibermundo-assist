/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#38a95e",
        "primary-dark": "#2C854A",
        "primary-light": "#71e133",
        "background-light": "#f8f8f5",
        "background-dark": "#23220f",
        "neutral-dark": "#181811",
        "neutral-light": "#8c8b5f",
        "border-light": "#e6e6db",
        "border-dark": "#3e3d24",
        "error-light": "#fecaca",
        "error-text": "#991b1b",
        "surface-light": "#ffffff",
        "surface-dark": "#2c2b15",
        "dark-text": "#181811",
      },
      fontFamily: {
        "display": ["Spline Sans", "sans-serif"],
        "body": ["Noto Sans", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "1rem", 
        "lg": "2rem", 
        "xl": "3rem", 
        "full": "9999px"
      },
      animation: {
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(250px)' },
        }
      }
    },
  },
  plugins: [],
}
