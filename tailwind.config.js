/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        noto: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        cairo: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        ibm: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        outfit: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        num: ['"Noto Kufi Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
        mono: ['"Noto Kufi Arabic"', 'Cairo', 'monospace', 'sans-serif'],
      },

      colors: {
        slate: {
          850: '#17223b',
        },
        sahara: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a9f7',
          500: '#0e8ce9',
          600: '#0270c7',
          700: '#0359a1',
          800: '#074c84',
          900: '#0c406e',
          950: '#082949',
        },
        navy: {
          800: '#0F172A',
          850: '#0D1527',
          900: '#0B132B',
          950: '#060B18',
        }
      },
      
      boxShadow: {
        'soft-card': '0 8px 30px rgba(0, 0, 0, 0.04)',
        'soft-hover': '0 20px 40px rgba(0, 0, 0, 0.08)',
        'glow-blue': '0 0 25px rgba(14, 140, 233, 0.35)',
        'glow-amber': '0 0 25px rgba(245, 158, 11, 0.35)',
        'glow-emerald': '0 0 25px rgba(16, 185, 129, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 3s ease-in-out infinite alternate',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateX(0) translateY(0)' },
          '50%': { transform: 'translateX(-25%) translateY(-4px)' },
          '100%': { transform: 'translateX(-50%) translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
