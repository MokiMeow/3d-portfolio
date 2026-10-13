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
pnpm test
pnpm build
```

## Project structure

- `src/experiences/home` contains the Three.js experience.
- `src/components/pages/home` contains the interface layered over the scene.
- `src/assets/models` contains the room models and baked textures.
- `src/public/models` contains the optimized WALL-E model, loaded independently of the room.
- `scripts` contains the mesh interaction, camera damping, and music URL regression tests.
- `docs` describes the room interactions, companion, and music integration.
- `src/content/notes/credits.md` records the original architecture and third-party resources used by the experience.

## Portfolio

Visit [smohith.vercel.app](https://smohith.vercel.app) for Mohith's main portfolio and current projects.

## Deployment

The Vercel project is `3d-portfolio` in `mokimeows-projects`. Link the checkout
with `vercel link --project 3d-portfolio` and run `vercel deploy` for a review
preview. The build command includes TypeScript validation. Environment overrides
are optional; see `.env.example`. Debug controls only run in local development.

Keep walkthrough captures, diagnostic logs, local environment files, and build
output outside version control. Vercel also excludes these from uploads.
