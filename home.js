// Homepage: sections are pre-rendered by the server; this only handles the newsletter form.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#newsletter-form');
  const note = document.querySelector('#newsletter-note');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    note.textContent = 'Subscribing...';
    try {
      const response = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Please try again.');
      note.textContent = "Thanks! You're on the list.";
      form.reset();
    } catch (error) {
      note.textContent = error.message;
    }
  });
});
