const rawSiteUrl = (process.env.SITE_URL || 'https://vectisadvisory.co.nz').trim();
const contactEmail = (process.env.CONTACT_EMAIL || '').trim();

function normaliseSiteUrl(value: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTPS origin, such as https://vectis.example, without a path or credentials.');
  }
  return url.origin;
}

if (contactEmail && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(contactEmail)) {
  throw new Error('CONTACT_EMAIL must be a public email address without display names or line breaks.');
}

export const site = {
  name: 'Vectis',
  url: normaliseSiteUrl(rawSiteUrl),
  contactEmail,
  contactHref: contactEmail ? `mailto:${encodeURIComponent(contactEmail)}` : undefined,
  description: 'Vectis helps civil, structural and construction engineering firms gain the understanding and capability to control their future proactively.',
};
