# GLADAITORS deploy rules

## Vercel project

- **Project:** `kp2kpxs-projects/gladaitors` (`gladaitors.vercel.app`)
- **Git repo:** `https://github.com/kp2kpx/gladaitors` only
- **Production branch:** `main`
- **Root directory:** `.` (repo root is this Next.js app)

## Never do this

- Do **not** connect `github.com/kp2kpx/2nd` to the gladaitors Vercel project.
- `kp2kpx/2nd` `main` is the stablecoin Vite app. It has its own Vercel project.
- Do not deploy gladaitors from the `2nd` repo or any branch that is not `kp2kpx/gladaitors`.

## Where to deploy from

- Local: `C:\Users\kamal\gladaitors\frontend`
- Remote: `https://github.com/kp2kpx/gladaitors`

## Build sanity check

- **Good GLADAITORS build:** typically **48 seconds or more** on Vercel.
- **Bad stablecoin build:** often around **20 seconds** (wrong app).

If a deploy finishes in ~20s, stop and verify the connected Git repo before promoting.

## Build guard

`npm run build` runs `scripts/verify-gladaitors.mjs` first (`prebuild`). The build fails if:

- `package.json` `name` is not `gladaitors`
- `app/layout.tsx` does not include `GLADAITORS` in metadata

## Production lock

Production is pinned to the Jun 6 rollback deployment. Do not run `vercel deploy --prod` unless explicitly requested.

## Stablecoin home

Stablecoin (`kp2kpx/2nd` `main`) deploys to a separate Vercel project:

- **Project:** `kp2kpxs-projects/base-stablecoin-viz`
- **URL:** `https://base-stablecoin-viz.vercel.app` (after first deploy from `2nd` `main`)
- **Never** point this repo or `kp2kpx/2nd` at the gladaitors Vercel project.