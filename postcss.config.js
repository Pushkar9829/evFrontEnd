import { fileURLToPath } from 'node:url';

// Resolve the Tailwind config next to this file, so the build works from any working directory.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
