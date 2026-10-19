const rawSiteUrl = (process.env.SITE_URL || 'https://vectisadvisory.co.nz').trim();
// Public Turnstile site key (safe to publish). Override with PUBLIC_TURNSTILE_SITE_KEY if it changes.
const turnstileSiteKey = (process.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFa8_dTTZ4EHJMlG').trim();

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
  description: 'Vectis helps construction sector companies gain the understanding and capability to control their future proactively.',
};
