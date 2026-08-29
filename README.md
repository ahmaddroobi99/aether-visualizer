# Aether

A cinematic music visualizer. Feed a microphone or an audio file and watch bars, rings, and waves follow the sound.

**Live:** [ahmaddroobi99.github.io/aether-visualizer](https://ahmaddroobi99.github.io/aether-visualizer/)

## Features

- Microphone input or uploaded / dropped tracks
- Five modes: Bars, Mirror, Radial, Orbit, Wave
- Color themes: Ice, Ember, Moss, Bloom, Noir, Rose
- Sensitivity, play/pause, seek, volume, fullscreen
- Keyboard: Space play/pause, F fullscreen, 1–5 modes, M mute

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (defaults to port 8080).

```bash
npm run build
npm run preview
```

GitHub Pages builds a static prerender (`GITHUB_PAGES=true`) so the visualizer can run without a server.

## Stack

React, TanStack Start, Tailwind CSS, Web Audio API, Canvas 2D.
