// Pequeñas mejoras de accesibilidad y UX:
// - Copiar email al portapapeles y notificar mediante aria-live
// - Poner año actual en el footer

document.getElementById('year').textContent = new Date().getFullYear();

const copyBtn = document.getElementById('copyEmailBtn');
const copyStatus = document.getElementById('copyStatus');
const email = 'hannaguzman611@gmail.com';

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = 'Email copiado al portapapeles';
    // feedback visual breve
    copyBtn.textContent = 'Email copiado';
    setTimeout(() => { copyBtn.textContent = 'Copiar email'; copyStatus.textContent = ''; }, 2000);
  } catch (e) {
    copyStatus.textContent = 'No se pudo copiar. Usá el enlace de email.';
  }
});
