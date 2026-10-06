/* ===== Éclipse — js/conta.js: a conta da mesa e o cofre do banco =====
   Um componente que se desenha sozinho. Ele não precisa de nenhum HTML pronto nem de uma
   folha de estilo por página: carrega o script e ele cria o botão, o painel e a skin.
   Motivo prático: esta barra de conta tem que existir nas SETE páginas (ficha, painel do
   mestre, portão). Se ela vivesse no HTML de cada uma, ia morrer numa delas — e as fichas
   iam amanhecer com recursos diferentes, que é exatamente o defeito que a mesa já me pegou
   quatro vezes.

   O que ele faz:
   - mostra o estado real do js/store.js (se está sincronizando sozinho, quantas chaves o banco
     tem, o que está subindo, que erro apareceu);
   - sobe esta máquina para o banco (`subirTudo`) — o "passar todas as fichas pro Firebase";
   - baixa o backup em .json antes de qualquer virada de banco (`dump`);
   - traduz erro do SDK em frase que dá para agir ("cole o database.rules.json no console").

   DESDE A v1.37 A CONTA É OPCIONAL. O sync não espera ninguém logar — ele acontece no abrir da
   página, com conta ou sem. A conta só muda o que aparece no campo `por` de cada escrita (quem
   mexeu), e nada mais. Por isso o formulário de login saiu do caminho e as ações do cofre
   apareceram de uma vez: na versão antiga, sem conta você não via nenhum botão.

   Ele nunca mexe em ficha nem decide nada do jogo: é só a porta do cofre. */
(function (global) {
  'use strict';

  const EMAIL_KEY = 'eclipse_conta_email_v1'; // só o e-mail lembrado, nunca a senha

  /* O store é procurado na hora do uso, não na hora do parse: se alguém mover as tags de
     <script> de lugar (ou o store.js atrasar num navegador lento), este painel encorega nele
     sozinho em vez de anunciar para sempre "o js/store.js não está nesta página". */
  let S = null;
  function pegueStore() {
    if (!S && global.ECLIPSE_STORE) {
      S = global.ECLIPSE_STORE;
      if (statusEl) { manual = null; S.onStatus(pintarStatus); }
    }
    return S;
  }

  function lerEmail() { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch (e) { return ''; } }
  function guardarEmail(v) { try { if (v) localStorage.setItem(EMAIL_KEY, v); else localStorage.removeItem(EMAIL_KEY); } catch (e) {} }

  const CSS = `
.eclipse-conta-btn {
  position: fixed; left: 18px; bottom: 18px; z-index: 70;
  font-family: var(--serif-title, 'Cinzel', serif);
  font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
  color: #efe4c8; background: rgba(24,22,28,.92);
  border: 1px solid rgba(201,162,75,.55); border-radius: 999px;
  padding: 10px 15px; cursor: pointer; box-shadow: 0 8px 22px rgba(0,0,0,.35);
  transition: .25s;
}
.eclipse-conta-btn:hover { background: #8a6a2f; color: #fff; transform: translateY(-2px); }
.eclipse-conta-btn.nuvem { border-color: #7fbf7f; }
.eclipse-conta-btn.local { border-color: #6b6480; }
.eclipse-conta-painel {
  position: fixed; left: 18px; bottom: 62px; z-index: 71;
  width: min(390px, calc(100vw - 36px));
  max-height: calc(100vh - 110px); overflow: auto;
  padding: 16px 16px 14px;
  background: linear-gradient(180deg, rgba(246,244,239,.98), rgba(232,228,218,.98));
  color: #3a3a40; border: 1px solid #c9a24b; border-radius: 8px;
  box-shadow: 0 24px 60px rgba(0,0,0,.55);
  font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16px;
}
.eclipse-conta-painel[hidden] { display: none; }
.eclipse-conta-painel h3 {
  font-family: var(--serif-title, 'Cinzel', serif); font-size: 13px; letter-spacing: 3px;
  text-transform: uppercase; color: #8a6a2f; margin: 0 0 8px;
}
.eclipse-conta-painel .linha { display: flex; flex-wrap: wrap; gap: 7px; margin: 7px 0; }
.eclipse-conta-painel input {
  flex: 1 1 150px; padding: 8px 10px; font: inherit; color: #2f2c26;
  background: #fffdf8; border: 1px solid #d9d6cf; border-bottom: 2px solid #c9a24b; border-radius: 3px;
}
.eclipse-conta-painel button {
  font-family: var(--serif-title, 'Cinzel', serif); font-size: 10.5px; letter-spacing: 1.6px;
  text-transform: uppercase; color: #fffdf6; background: linear-gradient(135deg,#8a6a2f,#c9a24b);
  border: none; border-radius: 3px; padding: 9px 12px; cursor: pointer; transition: .2s;
}
.eclipse-conta-painel button:hover { filter: brightness(1.08); }
.eclipse-conta-painel button.seco { background: #57535e; }
.eclipse-conta-painel button.perigo { background: #8b2f2f; }
.eclipse-conta-status {
  font-size: 14px; line-height: 1.45; padding: 8px 10px; border-radius: 5px;
  background: rgba(201,162,75,.12); border: 1px dashed #b7955a; margin-bottom: 8px;
}
.eclipse-conta-status.bad { background: rgba(150,50,50,.1); border-color: #a25454; color: #7c2f2f; }
.eclipse-conta-status.on { background: rgba(90,150,90,.12); border-color: #5e8f5e; }
.eclipse-conta-nota { font-size: 13.5px; color: #6a6354; font-style: italic; margin: 6px 0 0; }
.eclipse-conta-nota code { font-style: normal; background: rgba(58,58,64,.1); padding: 1px 4px; border-radius: 3px; }
html[data-theme="dark"] .eclipse-conta-painel {
  background: linear-gradient(180deg,#26242c,#1d1c22); color: #e7e2d6; border-color: #4b4256;
}
html[data-theme="dark"] .eclipse-conta-painel h3 { color: #e6cf94; }
html[data-theme="dark"] .eclipse-conta-painel input { background: #1f1e26; color: #ece6da; border-color: #3c3746; }
html[data-theme="dark"] .eclipse-conta-status { color: #ded4bb; }
html[data-theme="dark"] .eclipse-conta-status.bad { color: #f0b9b9; }
html[data-theme="dark"] .eclipse-conta-nota { color: #a9a296; }
@media (prefers-reduced-motion: reduce) { .eclipse-conta-btn:hover { transform: none; } }
`;

  let btn, painel, statusEl, emailEl, senhaEl, ultimoStatus = null, manual = null;

  function pintarStatus(s) {
    ultimoStatus = s;
    if (!statusEl) return;
    /* Uma resposta escrita por mim ("✔ dentro do banco como…", o relatório da subida) fica na
       tela uns segundos. Sem esta trava, o callback de estado passa aqui logo depois e
       apaga a frase que a pessoa ainda está lendo — o que parece bug, mas era só pressa. */
    if (manual && Date.now() < manual.ate) { statusEl.innerHTML = manual.html; statusEl.className = manual.cls; return; }
    manual = null;
    const partes = [];
    if (s.modo === 'nuvem') partes.push('☁ <b>sincronizando sozinho</b>');
    else partes.push('⛺ <b>modo local</b> — tudo só neste navegador');
    partes.push('mesa <b>' + esc(s.mesa) + '</b>');
    partes.push(s.naVem ? s.naVem + ' chaves no banco' : 'banco ainda vazio');
    partes.push('quem mexe aqui: <b>' + esc(s.quem) + '</b>');
    if (s.conta) partes.push('conta ' + esc(s.conta));
    if (s.pendentes) partes.push(s.pendentes + ' subindo…');
    if (s.conflito) partes.push(s.conflito + ' escrita(s) locais passaram por cima');
    if (!s.online) partes.push('sem internet agora');
    statusEl.innerHTML = partes.join(' · ');
    statusEl.className = 'eclipse-conta-status' + (s.erro ? ' bad' : (s.modo === 'nuvem' ? ' on' : ''));
    if (btn) {
      btn.className = 'eclipse-conta-btn ' + (s.modo === 'nuvem' ? 'nuvem' : 'local');
      btn.textContent = (s.modo === 'nuvem' ? '☁ ' : '⛺ ')
        + (s.pendentes ? s.pendentes + ' subindo' : (s.modo === 'nuvem' ? 'banco da mesa' : 'modo local'));
    }
    /* O formulário de conta só aparece enquanto não há conta (ele é opcional, não é a porta).
       Os botões do cofre ficam visíveis sempre — antes eles moravam escondidos atrás de "entre
       primeiro", e numa mesa onde ninguém tem conta isso significava "não dá para fazer nada". */
    const dentro = document.getElementById('contaDentro');
    if (dentro) dentro.hidden = !!s.conta;
    const sair = document.getElementById('contaSair');
    if (sair) sair.hidden = !s.conta;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Toda frase de resultado passa por aqui: mostra, e deixa o estado automático voltar
     sozinho depois de 14 segundos (senão a tela congela numa resposta antiga para sempre). */
  function dizer(html, cls) {
    manual = { html: html, cls: 'eclipse-conta-status ' + (cls || ''), ate: Date.now() + 14000 };
    statusEl.innerHTML = html;
    statusEl.className = manual.cls;
  }

  async function correr(fn, sucessoTxt) {
    if (!pegueStore()) { alert('O js/store.js não carregou — sem ele não há banco. Recarregue a página com a internet ligada.'); return; }
    const botao = document.activeElement;
    try { if (botao && botao.disabled === false) botao.disabled = true; } catch (e) {}
    try {
      const r = await fn();
      if (sucessoTxt) dizer(sucessoTxt(r), '');
      return r;
    } catch (e) {
      const m = (e && (e.code || e.message)) ? (e.code + ' ' + e.message) : String(e);
      dizer('✗ ' + traduz(m, e), 'bad');
    } finally {
      try { if (botao) botao.disabled = false; } catch (e) {}
      if (S) pintarStatus(S.status());
    }
  }

  /* O código do SDK não diz nada para quem não programa. Estas cinco linhas dizem o que
     fazer, porque são os cinco motivos que realmente acontecem numa mesa nova. */
  function traduz(bruto, e) {
    const t = String(bruto || '').toLowerCase();
    if (t.indexOf('permission-denied') !== -1 || t.indexOf('insufficient') !== -1) {
      return 'o banco recusou: as <b>regras</b> não estão deixando. Console → <b>Realtime Database → Regras</b> → cole o <code>database.rules.json</code> da raiz do projeto e aperte <b>Publicar</b>.';
    }
    if (t.indexOf('configuration-not-found') !== -1 || t.indexOf('operation-not-allowed') !== -1) {
      return 'login por <b>e-mail e senha</b> está desligado (Authentication → Sign-in method → E-mail/senha → Ativar). <b>Isto não quebra o sync</b>: a conta hoje é só uma assinatura opcional.';
    }
    if (t.indexOf('network-request-failed') !== -1) return 'sem internet, ou o CDN do Google não respondeu. O jogo continua local e atravessa sozinho quando voltar.';
    if (t.indexOf('auth/invalid-app-credential') !== -1 || t.indexOf('api-key') !== -1) return 'a apiKey do js/firebase-config.js não bate com o projeto.';
    if (t.indexOf('invalid-api-key') !== -1 || t.indexOf('api-key-not-valid') !== -1) return 'a apiKey do js/firebase-config.js não é válida para este projeto.';
    if (t.indexOf('user-not-found') !== -1 || t.indexOf('wrong-password') !== -1 || t.indexOf('invalid-credential') !== -1) return 'e-mail ou senha não conferem.';
    if (t.indexOf('weak-password') !== -1) return 'senha fraca: o Firebase pede 6 caracteres ou mais.';
    if (t.indexOf('email-already-in-use') !== -1) return 'esse e-mail já tem conta. Aperte “Entrar” em vez de “Criar conta”.';
    if (t.indexOf('invalid-email') !== -1) return 'este e-mail não é válido.';
    if (t.indexOf('unavailable') !== -1) return 'o banco indisponível agora; o site segue local e sincroniza quando voltar.';
    return esc((e && e.message) ? String(e.message).slice(0, 200) : String(bruto).slice(0, 200));
  }

  function entrar() {
    const em = emailEl.value, sen = senhaEl.value;
    if (!em || !sen) { dizer('Escreva o e-mail e a senha.', 'bad'); return; }
    correr(async function () {
      const u = await S.entrar(em, sen);
      guardarEmail(em); senhaEl.value = '';
      return '✔ dentro do banco como ' + esc(u.email) + '. Suas escritas saem assinadas com este e-mail (o sync já vinha acontecendo sem conta).';
    });
  }

  function criar() {
    const em = emailEl.value, sen = senhaEl.value;
    if (!/.+@.+\..+/.test(em)) { dizer('Precisa de um e-mail de verdade (com @ e domínio).', 'bad'); return; }
    if (!sen || sen.length < 6) { dizer('Senha: 6 caracteres ou mais (é a regra do Firebase).', 'bad'); return; }
    correr(async function () {
      const u = await S.criar(em, sen);
      guardarEmail(em); senhaEl.value = '';
      return '✔ conta criada: ' + esc(u.email) + '. Ela é só a assinatura: o que estiver no seu navegador ainda precisa ser puxado (“Puxar esta máquina para o banco”).';
    });
  }

  function subir(forcar) {
    if (!pegueStore()) return;
    const aviso = forcar
      ? 'FORÇAR a subida: cada chave desta máquina grava por cima do que está no banco AGORA.\n\nIsso apaga a versão do banco onde ela for diferente. Só use se esta máquina for mesmo a dona dos números certos.\n\nContinuar?'
      : 'Puxar TUDO desta máquina para o banco (fichas, armas, bestiário, históricos).\n\nO que já veio do banco nesta sessão não é reescrito. Continuar?';
    if (!global.confirm(aviso)) return;
    correr(async function () {
      const r = await S.subirTudo(forcar);
      const ok = r.filter(function (x) { return x.foi; });
      const nao = r.filter(function (x) { return !x.foi; });
      return '✔ subiram <b>' + ok.length + '</b> chaves (' + ok.reduce(function (a, x) { return a + (x.bytes || 0); }, 0) + ' bytes)'
        + (nao.length ? ' · <b>' + nao.length + '</b> ficaram: ' + nao.map(function (x) { return esc(x.chave) + ' → ' + esc(x.nota); }).join('; ') : '')
        + (ok.some(function (x) { return x.nota; }) ? ' · as fotos foram para o nó <code>retratos</code>' : '');
    });
  }

  function backup() {
    if (!pegueStore()) return;
    const texto = S.dump();
    const blob = new Blob([texto], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eclipse-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
    dizer('✔ backup baixado (' + Math.round(texto.length / 1024) + ' KB). Guarde antes de mexer no banco.', '');
  }

  function montar() {
    const est = document.createElement('style');
    est.textContent = CSS;
    document.head.appendChild(est);

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eclipse-conta-btn local';
    btn.textContent = '☁ banco da mesa';
    btn.addEventListener('click', function () { painel.hidden = !painel.hidden; });
    document.body.appendChild(btn);

    painel = document.createElement('div');
    painel.className = 'eclipse-conta-painel';
    painel.hidden = true;
    painel.innerHTML =
      '<h3>Banco da mesa</h3>' +
      '<div class="eclipse-conta-status" id="contaStatus">lendo…</div>' +
      '<div id="contaDentro">' +
      '<p class="eclipse-conta-nota">Conta é <b>opcional</b>: sem ela a mesa já sincroniza, e o que você mexer aparece na tela dos outros sozinho. Ter conta só troca a assinatura "sem-conta" pelo seu e-mail.</p>' +
      '<div class="linha"><input type="email" id="contaEmail" placeholder="e-mail" autocomplete="username" /></div>' +
      '<div class="linha"><input type="password" id="contaSenha" placeholder="senha" autocomplete="current-password" />' +
      '<button type="button" id="contaEntrar">Entrar</button></div>' +
      '<div class="linha"><button type="button" id="contaCriar">Criar conta</button></div>' +
      '</div>' +
      '<div class="linha"><button type="button" id="contaSubir">Puxar esta máquina para o banco</button></div>' +
      '<div class="linha"><button type="button" class="perigo" id="contaForcar">Forçar subida (grava por cima)</button>' +
      '<button type="button" class="seco" id="contaSair" hidden>Sair da conta</button></div>' +
      '<div class="linha"><button type="button" class="seco" id="contaBackup">Baixar backup .json</button>' +
      '<button type="button" class="seco" id="contaEmpurrar">Empurrar pendências</button></div>' +
      '<p class="eclipse-conta-nota"><b>Nada aqui precisa ser apertado no dia a dia.</b> Os botões de cima servem uma vez só, para virar a mesa deste navegador para o banco. "Empurrar pendências" é teimosia, para quando a fila atrasar.</p>' +
      '<p class="eclipse-conta-nota">Sem internet o jogo segue: as fichas continuam neste navegador e a fila atravessa quando a conexão voltar.</p>' +
      '<p class="eclipse-conta-nota">Se aparecer <code>permission-denied</code>, é o <code>database.rules.json</code> ainda não publicado (Realtime Database → Regras).</p>';
    document.body.appendChild(painel);

    statusEl = document.getElementById('contaStatus');
    emailEl = document.getElementById('contaEmail');
    senhaEl = document.getElementById('contaSenha');
    emailEl.value = lerEmail();

    const Liga = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    Liga('contaEntrar', entrar);
    Liga('contaCriar', criar);
    Liga('contaSubir', function () { subir(false); });
    Liga('contaForcar', function () { subir(true); });
    Liga('contaSair', function () { correr(function () { return S.sair(); }, function () { return '✔ saí da conta. A mesa continua sincronizando, agora assinada pelo crachá do salão.'; }); });
    Liga('contaBackup', backup);
    Liga('contaEmpurrar', function () { correr(function () { return S.flush(); }, function (n) { return '✔ empurradas ' + n + ' chaves da fila.'; }); });
    senhaEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); entrar(); } });

    if (pegueStore()) {
      S.onStatus(pintarStatus);
    } else {
      statusEl.className = 'eclipse-conta-status bad';
      statusEl.innerHTML = '✗ o <code>js/store.js</code> não está nesta página — sem ele o portão não fala com o banco.';
      /* E mesmo assim continua procurando: até 10 segundos, caso o store chegue atrasado. */
      const tenta = setInterval(function () {
        if (pegueStore() && S) { clearInterval(tenta); }
      }, 250);
      setTimeout(function () { clearInterval(tenta); }, 10000);
    }

    /* Fecha no Esc: quem abre painel num celular com a ficha aberta quer voltar rápido pro jogo. */
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && painel && !painel.hidden) painel.hidden = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})(window);
