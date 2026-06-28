/**
 * PostCSS configuration for the renderer.
 *
 * Tailwind generates the utility layer; Autoprefixer adds vendor prefixes for
 * the Chromium version Electron ships. Picked up automatically by Vite when
 * building the renderer.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
