import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        maestro: {
          primary: '#1A2F2A',
          'primary-light': '#243D36',
          accent: '#D4940A',
          'accent-light': '#E5A80A',
          'accent-bg': '#FDF6E3',
          cream: '#FAF8F5',
          surface: '#F5F2EE',
          border: '#E2DDD5',
          muted: '#7A8580',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
export default config
