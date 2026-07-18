# Mohith Lab

Mohith Lab is Sai Mohith S's interactive 3D portfolio. It turns a personal workroom into a navigable space for learning about Mohith's work, technical focus, and contact channels.

## Local development

Use Node.js 20 or 22 and pnpm 8.15.9.

```shell
pnpm install
pnpm dev
```

Production checks:

```shell
pnpm typecheck
pnpm build
```

## Project structure

- `src/experiences/home` contains the Three.js experience.
- `src/components/pages/home` contains the interface layered over the scene.
- `src/assets/models` contains the room models and baked textures.
- `src/content/notes/credits.md` records the original architecture and third-party resources used by the experience.

## Portfolio

Visit [smohith.vercel.app](https://smohith.vercel.app) for Mohith's main portfolio and current projects.
