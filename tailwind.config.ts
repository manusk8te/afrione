import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F0E8',
        bg2: '#EDE8DE',
        dark: '#0F1410',
        dark2: '#1A2018',
        accent: '#E85D26',
        accent2: '#2B6B3E',
        gold: '#C9A84C',
        muted: '#7A7A6E',
        cream: '#FAFAF5',
        border: '#D8D2C4',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Bricolage Grotesque', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
