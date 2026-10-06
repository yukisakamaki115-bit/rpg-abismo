/* ===== Motor de ficha (fichas novas: 4, 5 e as que vierem) =====
   Quem define a identidade é o js/ficha<n>.js, carregado ANTES deste arquivo:
     window.FICHA_CONF = { chave, quem, hp:{nome,max}, san:{nome,max}, attrs:{...}, eff:{morta,incap} }
   O motor é só a mecânica que já é igual em todas: vitais, os 5 atributos canônicos, efeitos
   (máx. 6), rolador, inventário do mestre, bestiário em leitura e histórico compartilhado.

   Por que separado e não copiar a ficha do Nox de novo:
   personagem2.js carrega as coisas dele (mundos, peles, 🧵 custo de poder, círculos de espaço).
   Nada disso é générale, e um copia-e-cola de 1.100 linhas viraria três ficheiros divergindo
   no próximo ajuste. Aqui é UM código atendendo N configs, e as fichas antigas ficam intocadas.

   Contratos que não podem mudar (senão quebra em silêncio):
   - os 5 atributos têm o MESMO nome em todas as fichas (só o valor difere);
   - ids no HTML: hpFill/sanFill/attrsGrid/invArea/mobList/rollLog... (uma página por vez, sem choque);
   - chaves globais: eclipse_roll_log / eclipse_activity (o painel do mestre lê as duas). */
(function (global) {
  'use strict';

  const CONF = global.FICHA_CONF;
  if (!CONF || !CONF.chave) return; // sem config (cache velha): deixa a página estática viver em paz

  const SAVE_KEY = CONF.chave;
  const PORTRAIT_KEY = SAVE_KEY + '_portrait';
  const WHO = CONF.quem;                 // identidade fixa nas rolagens/atividade (não é o nome editável)
  const ROLL_KEY = 'eclipse_roll_log';
  const ROLL_MAX = 60;
  const ACT_KEY = 'eclipse_activity';
  const ACT_MAX = 120;
  const ATTR_NOMES = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', carisma: 'Carisma' };
  const STATUS_MAX = 6;
  const EFF_MORTA = CONF.eff.morta;
  const EFF_INCAP = CONF.eff.incap;
  const GM_ONLY = [EFF_MORTA, EFF_INCAP];

  /* ---------- Estado ---------- */
  function defaultState() {
    const attrs = {};
    Object.keys(ATTR_NOMES).forEach(function (k) {
      attrs[k] = { nome: ATTR_NOMES[k], valor: (CONF.attrs && typeof CONF.attrs[k] === 'number') ? CONF.attrs[k] : 10 };
    });
    return {
      hp: CONF.hp.max, hpMax: CONF.hp.max,
      san: CONF.san.max, sanMax: CONF.san.max,
      /* armasIniciais: o que ela já chega tendo no bolso (o arco curto da Clara). É só um
         start: cai no mesmo state.armas que o mestre edita, então ele pode tirar/deixar. */
      status: [], armas: (CONF.armasIniciais || []).slice(), textos: {},
      atributos: attrs
    };
  }
  function load() {
    let s;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { s = defaultState(); }
      else {
        const old = JSON.parse(raw);
        /* CONF.identidade é a matrícula de QUEM está na ficha. Se o mestre reescreveu a
           personagem por cima de uma ficha que já tinha estado guardado no navegador
           (a ficha 5 era casca vazia e virou a Clara), aquele estado não é mais dela:
           atributos todos em 10 e nome velho apareceriam por cima da personagem nova.
           Mudou a string → nasce ficha limpa, e o que estava lá vai para um espelho de
           uma geração em vez de sumir. Ficha sem matrícula continua como sempre. */
        if (CONF.identidade && (!old || old.identidade !== CONF.identidade)) {
          try { localStorage.setItem(SAVE_KEY + '_espelho', JSON.stringify(old)); } catch (e) {}
          s = defaultState();
        } else { s = Object.assign(defaultState(), old); }
      }
    } catch (e) { s = defaultState(); }
    s.identidade = CONF.identidade || '';
    if (typeof s.hp !== 'number') s.hp = CONF.hp.max;
    if (typeof s.hpMax !== 'number') s.hpMax = CONF.hp.max;
    if (typeof s.san !== 'number') s.san = CONF.san.max;
    if (typeof s.sanMax !== 'number') s.sanMax = CONF.san.max;
    if (!Array.isArray(s.status)) s.status = [];
    if (!Array.isArray(s.armas)) s.armas = [];
    if (!s.textos || typeof s.textos !== 'object') s.textos = {};
    if (!s.atributos || typeof s.atributos !== 'object') s.atributos = defaultState().atributos;
    Object.keys(ATTR_NOMES).forEach(function (k) { // etiqueta canônica sempre, valor é do jogador
      if (!s.atributos[k] || typeof s.atributos[k].valor !== 'number') s.atributos[k] = { nome: ATTR_NOMES[k], valor: CONF.attrs[k] };
      s.atributos[k].nome = ATTR_NOMES[k];
    });
    // um teto que veio de outro lugar (o mestre mexeu) não pode deixar a barra acima de 100%
    s.hp = Math.max(0, Math.min(s.hp, s.hpMax));
    s.san = Math.max(0, Math.min(s.san, s.sanMax));
    return s;
  }
  let state = load();
  /* `CONF.migrar(state)`: existe para decisão de mesa que já está escrita no navegador de quem
     joga — nome antigo no título editável, linha de "contas abertas" que foi respondida. Roda uma
     vez, antes de qualquer desenho na tela, e só grava de volta se mexeu em algo: ficha que não
     mudou não sobe para o banco à toa. Ficha sem `migrar` (a Clara, as que vierem) segue igual. */
  let migrada = false;
  if (typeof CONF.migrar === 'function') {
    try { migrada = !!CONF.migrar(state); } catch (e) { migrada = false; }
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  if (CONF.identidade || migrada) save(); // grava a matrícula (e a migracao) na hora: senão resetaria no próximo F5

  const $ = function (id) { return document.getElementById(id); };
  function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); } // bind seguro: id faltando não derruba a ficha
  function clamp(v, lo, hi) { v = Math.round(Number(v)); if (!isFinite(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
  function mod(v) { return Math.max(0, Math.floor((v - 10) / 2)); }
  function fmtMod(m) { return (m >= 0 ? '+' : '−') + Math.abs(m); }

  /* ---------- Efeitos: o MESMO chip de "· +N" que o Nox/O Dante usam ----------
     Tudo que terminar em "· +N"/"· −N" entra na conta das rolagens (limitado a ±3 por marca,
     pra uma carta/efeito não virar bônus infinito). É exatamente a regra das outras fichas. */
  function chipValue(txt) {
    const m = /·\s*([+−])\s*(\d+)$/.exec(String(txt || ''));
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * Math.min(3, parseInt(m[2], 10) || 0);
  }
  function cardBonus() { return state.status.reduce(function (a, s) { return a + chipValue(s); }, 0); }
  function cardDetail() {
    let s = '';
    state.status.forEach(function (txt) {
      const v = chipValue(txt);
      if (v > 0) s += ' + ' + v + '✦';
      else if (v < 0) s += ' − ' + (-v) + '✦';
    });
    return s;
  }
  /* ---------- Porta para o bloco próprio da ficha (o lampião da Clara) ----------
     O motor não conhece poder nenhum de personagem — é justamente isso que evita que
     cada ficha vire uma cópia de 1.100 linhas. Um bloco próprio (js/lampiao.js) se
     inscreve aqui e o estado dele entra na conta E na fórmula escrita, do mesmo jeito
     que os círculos do Nox entram na ficha dele. Teto de ±3 por gancho: o mesmo dos
     chips, pra um estado próprio nunca virar bônus infinito. */
  const HOOKS = [];
  function hookTotal() {
    let n = 0;
    HOOKS.forEach(function (h) { n += clamp(h.value(), -3, 3); });
    return n;
  }
  function hookDetail() {
    let s = '';
    HOOKS.forEach(function (h) {
      const v = clamp(h.value(), -3, 3);
      if (v) s += (v > 0 ? ' + ' + v : ' − ' + (-v)) + (h.mark || '✦');
    });
    return s;
  }
  function bonusTotal() { return cardBonus() + hookTotal(); }

  function mortoBlock(out) {
    if (state.hp > 0 && !state.status.some(function (s) { return GM_ONLY.indexOf(s) !== -1; })) return false;
    if (out) { out.textContent = '☠️ Sem forças, não age. É o mestre (ou quem cuida dela) quem levanta.'; }
    return true;
  }

  /* ---------- Vitais ---------- */
  function renderHP() {
    const fill = $('hpFill'), txt = $('hpText');
    if (fill) fill.style.width = clamp((state.hp / state.hpMax) * 100, 0, 100) + '%';
    if (txt) txt.textContent = state.hp + ' / ' + state.hpMax;
  }
  function renderSAN() {
    const fill = $('sanFill'), txt = $('sanText');
    if (fill) fill.style.width = clamp((state.san / state.sanMax) * 100, 0, 100) + '%';
    if (txt) txt.textContent = state.san + ' / ' + state.sanMax;
  }
  /* Nomes das barras vêm da config, não do HTML: assim trocar "Brasa"/"Vínculo" por outra
     palavra é uma linha no js da ficha, e a página impressa atrás continua batendo. */
  function renderNomes() {
    const hn = $('hpNome'); if (hn) hn.textContent = CONF.hp.nome;
    const sn = $('sanNome'); if (sn) sn.textContent = CONF.san.nome;
    document.querySelectorAll('[data-nome-hp]').forEach(function (n) { n.textContent = CONF.hp.nome; });
    document.querySelectorAll('[data-nome-san]').forEach(function (n) { n.textContent = CONF.san.nome; });
  }
  function vitalPasso(bar, modo, inputId, msgId) {
    const campo = bar, max = bar + 'Max';
    if (modo === 'full') { state[campo] = state[max]; }
    else {
      const amt = parseInt($(inputId) ? $(inputId).value : 0, 10) || 0;
      if (amt <= 0) { // com a caixinha em 0 o botão não faz nada — e é preciso dizer isso, senão parece botão quebrado
        const m = $(msgId); if (m) m.textContent = '✧ escreva uma quantidade na caixinha antes do botão (ela está em 0).';
        return;
      }
      state[campo] = clamp(modo === 'dmg' ? state[campo] - amt : state[campo] + amt, 0, state[max]);
    }
    if (bar === 'hp') renderHP(); else renderSAN();
    renderStatus(); save();
  }

  /* ---------- Efeitos na tela ---------- */
  function renderStatus() {
    const box = $('statusChips'); if (!box) return;
    box.innerHTML = '';
    const count = $('statusCount'); if (count) count.textContent = state.status.length + '/' + STATUS_MAX;
    if (!state.status.length) {
      box.innerHTML = '<span class="chip empty">sem marcas — adicione com ＋ ou aguarde o mestre</span>';
      return;
    }
    state.status.forEach(function (s, i) {
      const gm = GM_ONLY.indexOf(s) !== -1;
      const chip = document.createElement('span');
      chip.className = 'chip' + (gm ? ' gm' : '') + (chipValue(s) < 0 ? ' neg' : '');
      chip.title = gm ? 'Só o mestre desfaz isso' : 'Clique para remover';
      chip.textContent = s;
      chip.addEventListener('click', function () {
        if (gm) { const m = $('statusMsg'); if (m) m.textContent = '☠️ ' + s + ' é decisão do mestre.'; return; }
        state.status.splice(i, 1); renderStatus(); save();
        activity(WHO, '✧ tirou "' + s + '"');
      });
      box.appendChild(chip);
    });
  }
  function efeitoAdd() {
    const inp = $('statusInput'); if (!inp) return;
    const nome = inp.value.trim();
    const m = $('statusMsg');
    if (!nome) return;
    if (state.status.indexOf(nome) !== -1) { if (m) m.textContent = 'Já está marcado.'; return; }
    if (state.status.length >= STATUS_MAX) { if (m) m.textContent = 'Limite de ' + STATUS_MAX + ' efeitos ativos.'; return; }
    state.status.push(nome); inp.value = '';
    if (m) m.textContent = '';
    renderStatus(); renderSAN(); save();
    activity(WHO, '➕ marcou "' + nome + '"');
  }

  /* ---------- Rolagem (fórmula aberta, sempre) ---------- */
  function faceDe(tipo) { return 1 + Math.floor(Math.random() * tipo); }
  function addRoll(entry) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    list.unshift({
      who: entry.who || WHO, txt: entry.txt || 'Rolagem', total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '', classe: entry.classe || '',
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now()
    });
    try { localStorage.setItem(ROLL_KEY, JSON.stringify(list.slice(0, ROLL_MAX))); } catch (e) {}
    renderLog();
  }
  function renderLog() {
    const ul = $('rollLog'); if (!ul) return;
    ul.innerHTML = '';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) { ul.innerHTML = '<li class="log-empty">Nenhuma rolagem ainda.</li>'; return; }
    list.slice(0, 40).forEach(function (l) {
      const li = document.createElement('li');
      li.className = (l.classe === 'crit' ? 'log-crit' : l.classe === 'fumble' ? 'log-fumble' : '');
      const who = document.createElement('span'); who.className = 'log-who' + (l.who === 'Mestre' ? ' mestre' : ''); who.textContent = l.who || 'Flora';
      li.appendChild(who);
      li.appendChild(Object.assign(document.createElement('span'), { textContent: (l.txt || 'Rolagem') }));
      const t = document.createElement('span'); t.className = 'log-total'; t.textContent = String(l.total);
      li.appendChild(t);
      const h = document.createElement('span'); h.className = 'log-detail'; h.textContent = l.hora || '';
      li.appendChild(h);
      ul.appendChild(li);
    });
  }
  function rolarAtributo(key, card) {
    const a = state.atributos[key]; if (!a) return;
    const out = card.querySelector('.attr-result');
    if (mortoBlock(out)) return;
    const b = bonusTotal();
    const face = faceDe(10);
    const total = face + a.valor + b;
    const det = cardDetail() + hookDetail();
    out.textContent = '🎲 ' + face + ' + ' + a.valor + det + ' = ' + total;
    addRoll({ who: WHO, txt: 'Rolou ' + a.nome + ' (d10 ' + fmtMod(a.valor + b) + ')' + det, total: total, detalhe: face, classe: face === 10 ? 'crit' : (face === 1 ? 'fumble' : '') });
    renderSAN(); save();
  }
  function renderAttrs() {
    const grid = $('attrsGrid'); if (!grid) return;
    grid.innerHTML = '';
    Object.keys(ATTR_NOMES).forEach(function (key) {
      const a = state.atributos[key];
      const card = document.createElement('div'); card.className = 'attr-card';
      card.innerHTML =
        '<div class="attr-top"><span class="attr-nome">' + a.nome + '</span><span class="attr-mod">' + fmtMod(mod(a.valor)) + '</span></div>' +
        '<input type="number" min="0" max="30" value="' + a.valor + '" />' +
        '<div class="attr-result combat-result"></div>' +
        '<div class="attr-hint">🎲 d10 + valor do Status (clique no card)</div>';
      const inp = card.querySelector('input');
      inp.addEventListener('input', function () {
        const n = parseInt(inp.value, 10); if (isNaN(n)) return;
        a.valor = clamp(n, 0, 30); inp.value = a.valor;
        card.querySelector('.attr-mod').textContent = fmtMod(mod(a.valor));
        fillBonusOptions(); save();
      });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      card.addEventListener('click', function () { rolarAtributo(key, card); });
      grid.appendChild(card);
    });
    fillBonusOptions();
  }
  function fillBonusOptions() {
    const sel = $('attrBonus'); if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="none">nenhum atributo</option>';
    Object.keys(state.atributos).forEach(function (k) {
      const a = state.atributos[k];
      const o = document.createElement('option');
      o.value = k; o.textContent = a.nome + ' (' + fmtMod(mod(a.valor)) + ')';
      sel.appendChild(o);
    });
    if (atual && atual !== 'none') sel.value = atual;
  }
  function rolarDado() {
    const tipo = parseInt($('diceType').value, 10) || 20;
    const qtde = clamp(parseInt($('diceQty').value, 10) || 1, 1, 10);
    const alvo = $('attrBonus').value;
    const a = (alvo && alvo !== 'none') ? state.atributos[alvo] : null;
    const out = $('rollMsg');
    if (mortoBlock(out)) return;
    let soma = 0; const faces = [];
    for (let i = 0; i < qtde; i++) { const f = faceDe(tipo); faces.push(f); soma += f; }
    const base = a ? a.valor : 0;
    const b = bonusTotal();
    const total = soma + base + b;
    const det = (base ? ' + ' + base : '') + cardDetail() + hookDetail();
    out.textContent = '🎲 ' + faces.join(' + ') + det + ' = ' + total;
    const um = qtde === 1 && tipo === 20;
    addRoll({ who: WHO, txt: (a ? a.nome : qtde + 'd' + tipo) + (a ? ' (d' + tipo + ' ' + fmtMod(base + b) + ')' : ''), total: total, detalhe: faces.join(', '), classe: (um && faces[0] === 20) ? 'crit' : ((um && faces[0] === 1) ? 'fumble' : '') });
    renderSAN(); save();
  }

  /* ---------- Inventário (o que o mestre envia) ---------- */
  function parseDice(txt) {
    const s = String(txt || '').trim().toLowerCase().replace(/\s+/g, '');
    const d = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (d) return { qtde: parseInt(d[1], 10) || 1, faces: parseInt(d[2], 10), bonus: parseInt(d[3] || '0', 10) };
    const f = s.match(/^([+-]?\d+)$/);
    if (f) return { qtde: 0, faces: 0, bonus: parseInt(f[1], 10) || 0 };
    return null;
  }
  function rolarArma(w, li) {
    const d = parseDice(w.dano);
    const out = li.querySelector('.weapon-result');
    if (mortoBlock(out)) return;
    if (!d) { out.textContent = '⚠ o mestre precisa definir um dano (ex: d8+2).'; return; }
    const b = bonusTotal();
    let total, faceTxt;
    if (d.qtde >= 1) {
      const faces = []; let soma = 0;
      for (let i = 0; i < d.qtde; i++) { const f = faceDe(d.faces); faces.push(f); soma += f; }
      total = soma + d.bonus + b; faceTxt = faces.join(' + ');
    } else { total = d.bonus + b; faceTxt = 'dano fixo'; }
    const det = (d.bonus ? (d.bonus >= 0 ? ' + ' + d.bonus : ' − ' + (-d.bonus)) : '') + cardDetail() + hookDetail();
    out.textContent = '🎲 ' + faceTxt + det + ' = ' + total + ' de dano';
    addRoll({ who: WHO, txt: 'Dano · ' + w.nome + ' (' + (w.dano || '—') + ')' + det, total: total, detalhe: faceTxt });
    renderSAN(); save();
  }
  function renderInv() {
    const area = $('invArea'); if (!area) return;
    if (!Array.isArray(state.armas) || !state.armas.length) return; // mantém o aviso de vazio do HTML
    area.innerHTML = '';
    const ul = document.createElement('ul'); ul.className = 'weapon-list';
    state.armas.forEach(function (w) {
      const li = document.createElement('li'); li.className = 'weapon-item';
      const name = document.createElement('span'); name.className = 'w-name'; name.textContent = '⚔ ' + w.nome;
      const dice = document.createElement('span'); dice.className = 'w-dice'; dice.textContent = w.dano || '—';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mini-btn w-roll'; btn.textContent = '🎲 Rolar';
      btn.addEventListener('click', function () { rolarArma(w, li); });
      const right = document.createElement('div'); right.className = 'w-actions'; right.appendChild(dice); right.appendChild(btn);
      const res = document.createElement('p'); res.className = 'weapon-result';
      li.appendChild(name); li.appendChild(right); li.appendChild(res);
      ul.appendChild(li);
    });
    area.appendChild(ul);
  }

  /* ---------- Retrato (upload + editor de enquadramento) ----------
     A peça agora mora no MOTOR, trazida do editor do Dante/Nox: arrastar dentro do círculo,
     zoom na rodinha e no slider. O modal é CRIADO aqui em JS, então a ficha 4, a ficha 5 e
     qualquer ficha nova já nascem com o ajustador, sem uma linha de HTML copiada.
     É gravado {src, zoom, panX, panY} na mesma chave de sempre; pan é fração do diâmetro,
     por isso o enquadramento sobrevive ao F5 e não desloca numa tela diferente. */
  /* Gancho do retrato: initPortrait guarda aqui o "reler + repintar", porque o estado do
     enquadramento vive no fechamento dela e o listener de storage, não. */
  let retratoRepintar = null;

  function initPortrait() {
    const wrap = $('portrait'), img = $('portraitImg'), hint = $('portraitHint'), file = $('portraitFile'), rm = $('portraitRemove');
    if (!wrap || !file) return;
    const STAGE = 280; // diâmetro do círculo do editor (bate com .crop-stage do ficha-base.css)

    let dado = null;   // {src, zoom, panX, panY} — o que ela emoldurou
    let padrao = null; // a arte padrão da ficha, enquanto ela não mexer no retrato

    /* Capa e posição em pixels sobre o tamanho natural da foto. Com object-fit a imagem
       fica "presa" na caixa e o arrasto não alcança as bordas dela. */
    function framing(el, box, p, nat) {
      if (!el || !nat || !nat.w || !nat.h || !box) return;
      const s = Math.max(box / nat.w, box / nat.h) * (p.zoom || 1);
      el.style.width = Math.round(nat.w * s) + 'px';
      el.style.height = Math.round(nat.h * s) + 'px';
      el.style.left = Math.round((box - nat.w * s) / 2 + (p.panX || 0) * box) + 'px';
      el.style.top = Math.round((box - nat.h * s) / 2 + (p.panY || 0) * box) + 'px';
    }
    /* PNG com transparência não pode virar JPEG sem fundo: o vazio do alpha sairia preto.
       O fundo é o cartão da própria ficha, lido do tema que está na tela agora. */
    function corDoDisco() {
      const v = getComputedStyle(document.body).getPropertyValue('--fs-card').trim();
      return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#1a161c';
    }
    function pintar() {
      const src = dado ? dado.src : padrao;
      if (!src) {
        img.removeAttribute('src'); img.hidden = true;
        wrap.classList.remove('has-img');
        if (hint) hint.textContent = '✦ clicar para carregar imagem ✦';
        if (rm) rm.hidden = true;
        wrap.title = 'Clique para carregar a imagem dela';
        return;
      }
      img.onload = function () {
        framing(img, wrap.clientWidth, dado || { zoom: 1 }, { w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = src; img.hidden = false;
      wrap.classList.add('has-img');
      if (hint) hint.textContent = '✦ clicar para ajustar ✦';
      if (rm) rm.hidden = false;
      wrap.title = 'Clique para ajustar a imagem dela';
    }
    function gravar() {
      if (!dado) { try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify({ removido: true })); } catch (e) {} return; }
      try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify(dado)); }
      catch (e) { alert('A imagem apareceu, mas é grande demais para salvar aqui. Tente uma versão mais leve.'); }
    }
    /* Reler a chave — na abertura, e quando OUTRA aba da mesma ficha mexer no retrato
       (o listener de storage chama isto pelo gancho abaixo). Sem isso a tela ficaria
       pregada no quadro velho enquanto o armazenamento já tinha o novo. */
    function reler() {
      dado = null; padrao = null;
      try {
        let p = JSON.parse(localStorage.getItem(PORTRAIT_KEY) || 'null');
        if (typeof p === 'string') p = p ? { src: p } : null; // resíduo de versão antiga: a data-url solta na chave
        if (p && p.src) dado = { src: p.src, zoom: p.zoom || 1, panX: p.panX || 0, panY: p.panY || 0 };
        else if (!p && CONF.retrato) padrao = CONF.retrato; // a arte padrão, até ela mexer nela
      } catch (e) { if (CONF.retrato) padrao = CONF.retrato; }
      pintar();
    }
    retratoRepintar = reler;
    reler();

    /* ----- o modal do editor: criado em JS porque é peça do motor, não da página ----- */
    let modal = document.getElementById('cropModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay'; modal.id = 'cropModal'; modal.hidden = true;
      modal.innerHTML =
        '<div class="modal">' +
          '<h3>Ajustar retrato</h3>' +
          '<p class="modal-sub">Arraste a foto dentro do círculo e use o zoom até emoldurar como quiser. A rodinha do mouse também dá zoom.</p>' +
          '<div class="crop-stage" id="cropStage"><img id="cropImg" alt="" draggable="false" /></div>' +
          '<div class="crop-controls">' +
            '<label>Zoom <input type="range" id="cropZoom" min="1" max="3" step="0.01" value="1" /></label>' +
            '<button type="button" class="mini-btn" id="cropSwap">🖼 Trocar imagem</button>' +
          '</div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="mini-btn" id="cropCancel">Cancelar</button>' +
            '<button type="button" class="btn-major" id="cropOk">✔ Usar assim</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    const stage = $('cropStage'), stageImg = $('cropImg'), zoomInput = $('cropZoom');
    let crop = null, natural = { w: 1, h: 1 }, drag = null;

    // o quanto dá pra empurrar a foto sem deixar borda de disco aparecendo
    function limites(z) {
      const s = Math.max(STAGE / natural.w, STAGE / natural.h);
      const rw = natural.w * s * z, rh = natural.h * s * z;
      return {
        x: Math.max(0, (rw - STAGE) / 2) / STAGE,
        y: Math.max(0, (rh - STAGE) / 2) / STAGE
      };
    }
    function desenharCrop() {
      if (!crop) return;
      const l = limites(crop.zoom);
      crop.panX = Math.max(-l.x, Math.min(l.x, crop.panX));
      crop.panY = Math.max(-l.y, Math.min(l.y, crop.panY));
      framing(stageImg, STAGE, crop, natural);
      if (zoomInput) zoomInput.value = crop.zoom;
    }
    function abrirCrop(p) {
      if (!p || !p.src) return;
      crop = { src: p.src, zoom: p.zoom || 1, panX: p.panX || 0, panY: p.panY || 0 };
      stageImg.src = crop.src;
      const probe = new Image();
      probe.onload = function () { natural = { w: probe.naturalWidth, h: probe.naturalHeight }; desenharCrop(); };
      probe.src = crop.src;
      modal.hidden = false;
    }
    function fecharCrop() { modal.hidden = true; crop = null; drag = null; }

    stage.addEventListener('pointerdown', function (e) {
      if (!crop) return;
      drag = { x: e.clientX, y: e.clientY, px: crop.panX, py: crop.panY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {} // sem ponteiro ativo o browser recusa; o arrasto segue mesmo assim
    });
    stage.addEventListener('pointermove', function (e) {
      if (!crop || !drag) return;
      crop.panX = drag.px + (e.clientX - drag.x) / STAGE;
      crop.panY = drag.py + (e.clientY - drag.y) / STAGE;
      desenharCrop();
    });
    stage.addEventListener('pointerup', function () { drag = null; });
    stage.addEventListener('pointercancel', function () { drag = null; });
    stage.addEventListener('wheel', function (e) {
      if (!crop) return;
      e.preventDefault();
      crop.zoom = Math.max(1, Math.min(3, crop.zoom - e.deltaY * 0.0015));
      desenharCrop();
    }, { passive: false });
    if (zoomInput) zoomInput.addEventListener('input', function () {
      if (!crop) return;
      crop.zoom = Math.max(1, Math.min(3, parseFloat(zoomInput.value) || 1));
      desenharCrop();
    });
    on('cropSwap', 'click', function () { fecharCrop(); file.click(); });
    on('cropCancel', 'click', fecharCrop);
    on('cropOk', 'click', function () {
      if (!crop) { fecharCrop(); return; }
      dado = crop; padrao = null;
      pintar(); gravar(); fecharCrop();
      activity(WHO, '🖼 ajustou o retrato');
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharCrop(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) fecharCrop();
    });

    wrap.addEventListener('click', function () {
      if (dado) { abrirCrop(dado); return; }        // já tem retrato: clicar AJUSTA
      if (padrao) { abrirCrop({ src: padrao, zoom: 1, panX: 0, panY: 0 }); return; }
      file.click();                                 // limpo: clicar sobe imagem
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wrap.click(); }
    });
    file.addEventListener('change', function () {
      const f = file.files && file.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        const im = new Image();
        im.onload = function () {
          const MAX = 1100;
          let w = im.width, h = im.height;
          if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = corDoDisco(); ctx.fillRect(0, 0, w, h); // achata o alpha antes do JPEG
          ctx.drawImage(im, 0, 0, w, h);
          abrirCrop({ src: cv.toDataURL('image/jpeg', 0.9), zoom: 1, panX: 0, panY: 0 });
        };
        im.onerror = function () { alert('Não consegui abrir essa imagem.'); };
        im.src = ev.target.result;
      };
      reader.readAsDataURL(f);
      file.value = '';
    });
    if (rm) rm.addEventListener('click', function (e) {
      e.stopPropagation();
      dado = null; padrao = null;
      /* {removido:true} em vez de apagar a chave: é o que deixa a arte padrão (CONF.retrato)
         de volta sozinha no F5 — se ela tirou o retrato, é porque quis tirar. */
      try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify({ removido: true })); } catch (e2) {}
      pintar();
    });
  }

  /* ---------- Textos editáveis (tudo que é contenteditable vira state.textos) ---------- */
  function initTextos() {
    document.querySelectorAll('[data-txt]').forEach(function (el) {
      const k = el.getAttribute('data-txt');
      if (typeof state.textos[k] === 'string' && state.textos[k].length) el.innerHTML = state.textos[k];
      el.addEventListener('blur', function () {
        state.textos[k] = el.innerHTML;
        /* O bloco data-txt="nome" é o único que vira dado, não só texto: a tela do
           mestre lê state.nome para titular o card. Fica salvo no mesmo objeto. */
        if (k === 'nome') state.nome = el.textContent.trim() || CONF.quem;
        save();
        activity(WHO, '✎ mexeu em um texto');
      });
    });
  }

  /* ---------- Abas (o mesmo data-tab → #panel-<nome> das outras fichas) ---------- */
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        const alvo = $('panel-' + btn.dataset.tab);
        if (alvo) alvo.classList.add('active');
      });
    });
  }

  /* ---------- Monitor de atividade (o mestre vê na tela dele) ---------- */
  function activity(who, act) {
    if (!act) return;
    let l = [];
    try { l = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({ who: who || WHO, act: String(act).slice(0, 80), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    try { localStorage.setItem(ACT_KEY, JSON.stringify(l.slice(0, ACT_MAX))); } catch (e) {}
  }
  function describeEl(node) {
    if (!node || !node.tagName) return null;
    const act = (node.getAttribute('data-act') || '').trim(); if (act) return act;
    if (node.classList && node.classList.contains('no-act')) return null;
    if (node.classList && node.classList.contains('tab-btn')) return '🗂 abriu a aba ' + (node.textContent || '').trim();
    if (node.tagName === 'BUTTON') {
      const txt = (node.textContent || '').trim();
      if (!txt || txt.indexOf('🎲') !== -1) return null; // rolagens já caem no histórico
      return txt.length > 42 ? null : '👆 ' + txt;
    }
    return null;
  }

  /* ---------- Ligações ---------- */
  initTabs();
  initTextos();
  initPortrait();
  renderNomes();
  renderAttrs();
  renderHP(); renderSAN(); renderStatus(); renderInv(); renderLog();

  on('hpDmg', 'click', function () { vitalPasso('hp', 'dmg', 'hpInput', 'statusMsg'); });
  on('hpHeal', 'click', function () { vitalPasso('hp', 'heal', 'hpInput', 'statusMsg'); });
  on('hpFull', 'click', function () { vitalPasso('hp', 'full', 'hpInput', 'statusMsg'); });
  on('sanDmg', 'click', function () { vitalPasso('san', 'dmg', 'sanInput', 'statusMsg'); });
  on('sanHeal', 'click', function () { vitalPasso('san', 'heal', 'sanInput', 'statusMsg'); });
  on('sanFull', 'click', function () { vitalPasso('san', 'full', 'sanInput', 'statusMsg'); });
  on('statusAddBtn', 'click', efeitoAdd);
  on('statusInput', 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); efeitoAdd(); } });
  on('rollBtn', 'click', rolarDado);

  document.addEventListener('click', function (e) {
    const node = e.target && e.target.closest ? e.target.closest('button, .tab-btn, a') : null;
    if (!node) return;
    if (node.closest('#cropModal')) return; // o editor já anuncia sozinho "🖼 ajustou o retrato": sem log gêmeo
    const desc = describeEl(node);
    if (desc) activity(WHO, desc);
  }, true);

  // ao vivo: o mestre mexeu nesta ficha noutra aba → reler e redesenhar
  global.addEventListener('storage', function (e) {
    if (e.key === ROLL_KEY) { renderLog(); return; }
    if (e.key === PORTRAIT_KEY) { if (retratoRepintar) retratoRepintar(); return; }
    if (e.key === SAVE_KEY) {
      state = load();
      renderHP(); renderSAN(); renderStatus(); renderAttrs(); renderInv();
    }
  });

  /* ---------- API para o bloco próprio da ficha (js/lampiao.js e o que vier) ----------
     O bloco usa o MESMO state que o motor salva (uma ficha = uma chave = uma história
     coerente) e as três portas de efeito: chip, gancho de bônus e rolagem no histórico
     compartilhado. Sem isto o poder novo teria que duplicar motor e save — que é
     exatamente o que a v1.30 quis evitar. */
  global.FICHA_API = {
    CONF: CONF, WHO: WHO,
    state: function () { return state; },
    save: save, clamp: clamp, face: faceDe,
    roll: addRoll, activity: activity,
    /* A conta de bônus da ficha (chips · ±N do mestre + ganchos dos blocos próprios) também
       sai pela API: um teste escrito no bloco da personagem tem que somar o MESMO que uma
       rolagem do motor soma, senão o mestre marca "Desfocada · −2" e metade dela ignora. */
    bonus: bonusTotal, bonusDetail: function () { return cardDetail() + hookDetail(); },
    /* vida/sanidade por valor assinado: o lampião cobra em sanidade, e a barra precisa
       mostrar exatamente o número que a mensagem dele mostrou. */
    vital: function (bar, delta) {
      const max = bar === 'hp' ? state.hpMax : state.sanMax;
      state[bar] = clamp(state[bar] + delta, 0, max);
      if (bar === 'hp') renderHP(); else renderSAN();
      save();
    },
    chip: {
      has: function (n) { return state.status.indexOf(n) !== -1; },
      add: function (n) {
        if (state.status.indexOf(n) !== -1) return true;
        if (state.status.length >= STATUS_MAX) return false;
        state.status.push(n); renderStatus(); save(); return true;
      },
      remove: function (n) {
        const i = state.status.indexOf(n);
        if (i !== -1) { state.status.splice(i, 1); renderStatus(); save(); }
      }
    },
    hook: function (mark, fn) { HOOKS.push({ mark: mark, value: fn }); },
    redraw: function () { renderHP(); renderSAN(); renderStatus(); renderAttrs(); renderInv(); renderLog(); }
  };

  global.__FICHA_OK = true; // o aviso de "motor não carregou" na página usa esta bandeira
})(window);
