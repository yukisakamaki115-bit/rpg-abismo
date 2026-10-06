/* ===== Éclipse — alternador de tema claro/escuro (local, via localStorage) ===== */
(function () {
  const KEY = 'eclipse_theme';

  function apply() {
    if (localStorage.getItem(KEY) === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Aplica o quanto antes (evita "flash" de cor errada)
  apply();

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.title = 'Alternar entre tema claro e escuro';

    function label() {
      const dark = document.documentElement.hasAttribute('data-theme');
      btn.textContent = dark ? '☀ Tema claro' : '☾ Tema escuro';
    }
    label();

    btn.addEventListener('click', function () {
      const dark = document.documentElement.hasAttribute('data-theme');
      if (dark) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, 'dark');
      apply();
      label();
    });

    document.body.appendChild(btn);
  });
})();
