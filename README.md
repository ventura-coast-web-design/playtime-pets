# Playtime Pets

A Pet Toy business website built with Eleventy and Liquid templating.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build CSS:
```bash
npm run build:css
```

3. Build site:
```bash
npm run build
```

4. Watch and serve (development):
```bash
npm start
```

This will:
- Watch SCSS files and compile to CSS
- Serve the site at http://localhost:8080
- Watch for changes and rebuild automatically

## Project Structure

```
src/
  _data/          # Data files (JSON, JS, etc.)
  _includes/      # Templates and partials
    layouts/      # Layout templates
  assets/
    scss/         # SCSS source files
    css/          # Compiled CSS (generated)
    images/       # Image assets
    js/           # JavaScript files
  index.liquid    # Homepage
_site/            # Generated site (output directory)
```

## SCSS Structure

Build out your SCSS files in `src/assets/scss/`. The main entry point is `main.scss`, which compiles to `src/assets/css/main.css`.
