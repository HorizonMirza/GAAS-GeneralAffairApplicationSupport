This is the frontend of **GAAS** (General Affair Application System, built for PGN Solution) — a [Next.js](https://nextjs.org) project (App Router) bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). For project-specific setup, architecture, and module details, see [`docs/README.md`](../docs/README.md) and [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) at the repo root — this file only covers generic Next.js tooling.

## Getting Started

This frontend needs the backend (`../backend`) running separately, and `frontend/.env.local` set with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` (see `docs/README.md` for the full local setup, including the backend and database).

Once that's in place, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

This app is deployed internally alongside its ASP.NET Core backend and PostgreSQL database, not on Vercel — see [`docs/README.md`](../docs/README.md) for the actual deployment/runtime setup.
