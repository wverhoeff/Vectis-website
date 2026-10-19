// Contact form: checks fields in the browser, sends without leaving the page,
// and shows errors beside the field they belong to. Without this script the
// form still posts normally to the same endpoint.
const form = document.querySelector('.contact-form');

if (form) {
  form.noValidate = true; // the script shows its own messages beside each field
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  const messages = {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    message: 'Please tell us a little about what you need.',
  };

  function setError(name, text) {
    const input = form.elements[name];
    const out = form.querySelector(`#e-${name}`);
    if (!input || !out) return;
    out.textContent = text || '';
    input.toggleAttribute('aria-invalid', !!text);
    if (text) input.setAttribute('aria-describedby', out.id); else input.removeAttribute('aria-describedby');
  }

  function check(input) {
    if (!messages[input.name]) return true;
    const ok = input.checkValidity();
    setError(input.name, ok ? '' : messages[input.name]);
    return ok;
  }

  form.addEventListener('blur', e => { if (e.target.matches('input, textarea') && e.target.value) check(e.target); }, true);
  form.addEventListener('input', e => { if (e.target.hasAttribute('aria-invalid')) check(e.target); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = ''; status.className = 'form-status';
    const required = ['name', 'email', 'message'].map(n => form.elements[n]);
    const bad = required.filter(input => !check(input));
    if (bad.length) { bad[0].focus(); return; }

    button.disabled = true; button.textContent = 'Sending…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const result = await response.json().catch(() => ({ ok: false }));
      if (result.ok) {
        form.reset();
        status.textContent = "Thanks, your message is on its way. We'll be in touch soon.";
        status.classList.add('is-success');
        window.turnstile?.reset();
      } else {
        for (const [name, text] of Object.entries(result.fields || {})) setError(name, text);
        status.textContent = result.error || 'Your message did not send. Please try again.';
        status.classList.add('is-error');
        window.turnstile?.reset();
        const first = form.querySelector('[aria-invalid]'); if (first) first.focus();
      }
    } catch {
      status.textContent = 'We could not reach the server. Please check your connection and try again.';
      status.classList.add('is-error');
    } finally {
      button.disabled = false; button.textContent = label;
    }
  });
}
