const rawSiteUrl = (process.env.SITE_URL || 'https://vectisadvisory.co.nz').trim();
const turnstileSiteKey = (process.env.PUBLIC_TURNSTILE_SITE_KEY || '').trim();

function normaliseSiteUrl(value: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTPS origin, such as https://vectis.example, without a path or credentials.');
  }
  return url.origin;
}

export const site = {
  name: 'Vectis',
  url: normaliseSiteUrl(rawSiteUrl),
  turnstileSiteKey,
  description: 'Vectis helps civil, structural and construction engineering firms gain the understanding and capability to control their future proactively.',
};
