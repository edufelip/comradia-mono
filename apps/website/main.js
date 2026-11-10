const form = document.getElementById('waitlist');
const emailInput = document.getElementById('waitlist-email');
const statusEl = document.getElementById('waitlist-status');

if (form && emailInput && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    statusEl.textContent = 'Solidarity received — you are on the Comradia early access list.';
    emailInput.value = '';
  });
}
