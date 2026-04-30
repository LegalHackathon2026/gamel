// postcss.config.mjs
// Tailwind v4: use @tailwindcss/postcss, NOT the old 'tailwindcss' plugin
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
