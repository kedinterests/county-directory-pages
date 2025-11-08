// tailwind.config.js
module.exports = {
  content: [
    "./functions/**/*.js",   // SSR templates in your Pages Functions
    "./public/**/*.html"     // any static HTML you might add
  ],
  theme: {
    extend: {}
  },
  plugins: [
    require('@tailwindcss/line-clamp')  // we use line-clamp-3 on descriptions
  ]
};
