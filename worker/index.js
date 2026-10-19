// Vectis Worker: serves the built site from ./dist and handles the contact form.
import { onRequestPost, onRequest } from './contact.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact' || pathname === '/api/contact/') {
      return request.method === 'POST' ? onRequestPost({ request, env, ctx }) : onRequest();
    }
    return env.ASSETS.fetch(request);
  },
};
