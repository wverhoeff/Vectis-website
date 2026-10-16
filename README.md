# Vectis website

A static Astro site for **https://vectisadvisory.co.nz**. It uses the approved Midnight Cyan branding and original logo, with an interactive architectural illustration, capabilities and a training/adoption section.

## Local development

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm run build
npm run preview
```

Astro writes the deployable static files to `dist/`. The site does not require a database, server runtime, API key or Cloudflare adapter. Development and preview use port 4321 by default.

## Deploy from GitHub to Cloudflare Pages

1. In Cloudflare, open **Workers & Pages** and create a **Pages** project using **Import an existing Git repository** / **Connect to Git**. Choose Pages, not a Worker requiring a deploy command. Dashboard labels can vary.
2. Authorise Cloudflare's GitHub integration to access `wverhoeff/Vectis-website`, and select that repository.
3. Apply these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Leave blank (repository root) |
| Environment variable | `NODE_VERSION` = `24` |

4. Save and deploy. Cloudflare installs the locked dependencies and builds the site. Check the generated `pages.dev` deployment before changing the custom domain.
5. Under the project's **Custom domains**, add `vectisadvisory.co.nz`. Complete the DNS instructions Cloudflare shows. For the apex domain, the domain must be an active zone in the same Cloudflare account; existing Cloudflare DNS setup may already satisfy this.
6. If you also want `www.vectisadvisory.co.nz`, add it to the Pages project and configure a Cloudflare redirect rule from `www` to `https://vectisadvisory.co.nz`, preserving path and query string.

Use the Pages **Custom domains** flow; adding only a DNS record does not associate the domain with the project. Preserve email-related MX and TXT records.

After connection, pushes to `main` deploy production. Other branches and pull requests can generate preview deployments. No GitHub Actions deployment workflow or Cloudflare token is needed for this integration.

## Public configuration

| Variable | Default / effect |
| --- | --- |
| `SITE_URL` | `https://vectisadvisory.co.nz`. Used for canonical links, social metadata and the sitemap. Must be an HTTPS origin without a path. |
| `CONTACT_EMAIL` | Unset. When provided, adds a Contact link and an email section. No address is invented or displayed until one is supplied. |

These are public values, not secrets. Add them to the Pages project's build environment and redeploy after changing them. For local development, export them in your shell; `.env.example` documents the expected format. The code uses `process.env`, so a `.env` file alone is not a configuration loader.

Example with a test address for local checking only:

```sh
CONTACT_EMAIL=hello@example.com npm run build
```

## What is included

- Responsive homepage with the deck's core messaging.
- Server-rendered SVG structural illustration, enhanced by a small local script.
- Pause/resume, reduced-motion support, desktop pointer response and automatic pausing when offscreen or in a hidden tab.
- Native expandable capability sections that work without JavaScript.
- A custom 404 page, canonical/social metadata, `robots.txt`, sitemap and basic response headers.
- No external fonts, analytics, tracking scripts or embedded third-party applications.

The illustration is conceptual. It does not claim a specific modelling or compliance product. Client names and identifying case studies are omitted. Founder biographies, individual product pages and an LMS are outside this initial launch scope.

## Editing

- `src/pages/index.astro`: homepage structure and capability text.
- `src/styles/site.css`: responsive layout and brand styling.
- `src/components/Structure.astro`: the static structural model.
- `src/scripts/motion.js`: progressive animation.
- `src/config.ts`: public site settings and metadata.
- `src/layouts/Page.astro`: shared HTML and metadata.

The logo in `public/assets/vectis-wordmark.png` is the unmodified embedded image from the approved [brand deck](https://docs.google.com/presentation/d/1W96ywlMSlRz7wUZTbUSPalcDfRe6ABqpYHXsfDk-wmw/edit). Keep its shape and proportions intact. An original vector export can replace it later.

## Deployment verification

Before launch, check the homepage and custom 404 on `pages.dev`, the animation and pause button, capability expansion, mobile scrolling, and any configured email link. After adding the domain, check HTTPS, the canonical URL and `/sitemap.xml` on `vectisadvisory.co.nz`.

Local build/browser checks do not prove the GitHub integration, Cloudflare build or domain connection has completed. Those need verification after the project is created in Cloudflare.

References: [Cloudflare's Astro guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
