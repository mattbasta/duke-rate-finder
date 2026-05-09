/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        plan: {
          res: '#0ea5e9',
          toud: '#22c55e',
          tou: '#eab308',
          cpp: '#ef4444',
          ev: '#a855f7',
        },
      },
    },
  },
  plugins: [],
};
