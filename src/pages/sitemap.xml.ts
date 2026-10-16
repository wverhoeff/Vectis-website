import { site } from '../config';
export function GET() {
  const escape = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const home = site.url ? `<url><loc>${escape(site.url)}/</loc></url>` : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${home}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
