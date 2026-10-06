/* ===== Ficha do Dante (antes: Santiago) — humano cartomante (lógica local, sem Firebase) ===== */
(function () {
  'use strict';

  const SAVE_KEY = 'eclipse_santiago_v1';
  const PORTRAIT_KEY = SAVE_KEY + '_portrait';
  const STORY_KEY = SAVE_KEY + '_story';
  const WHO = 'Dante'; // identidade nas rolagens/atividade (antes era 'Santiago' — o painel do mestre aceita os dois)

  // Chaves GLOBAIS compartilhadas com as outras fichas + mestre
  const ROLL_KEY = 'eclipse_roll_log';
  const ROLL_MAX = 60;
  const ACT_KEY = 'eclipse_activity';
  const ACT_MAX = 120;

  const STATUS_MAX = 6;

  // Fichas aliadas que recebem efeitos de carta (mesmo navegador = localStorage junto)
  // `morto` é a EXATA etiqueta que cada ficha (e o painel do mestre) usa pra morte — tem que bater.
  // `caiu` é o gênero da frase ("está MORTO" / "está MORTA").
  // Vesper e Clara entraram aqui na v1.31.3: elas também sentam na mesa do tarot.
  const SHEETS = {
    santiago: { key: SAVE_KEY, nome: 'Dante', emoji: '🔮', morto: '☠️ Morto', incap: '🟡 Incapacitado', caiu: 'MORTO' },
    flora:    { key: 'eclipse_flora_v1', nome: 'Flora', emoji: '🌹', morto: '☠️ MORTA', incap: '🟡 Incapacitada', caiu: 'MORTA' },
    nox:      { key: 'eclipse_coelho_v1', nome: 'Nox', emoji: '🐰', morto: '☠️ Morto', incap: '🟡 Incapacitado', caiu: 'MORTO' },
    vesper:   { key: 'eclipse_ficha4_v1', nome: 'Vesper', emoji: '🕯️', morto: '☠️ Apagada', incap: '🟡 Vacilando', caiu: 'APAGADA' },
    clara:    { key: 'eclipse_ficha5_v1', nome: 'Clara', emoji: '🏮', morto: '☠️ Morta', incap: '🟡 Incapacitada', caiu: 'MORTA' }
  };
  // Marcas do mestre: o jogador NÃO descarta clicando na ficha dele
  const GM_ONLY = ['☠️ Morto', '☠️ MORTA', '🟡 Incapacitado', '🟡 Incapacitada'];

  // ---------- O Baralho — 22 Arcanos Maiores (as % somam 100) ----------
  // fx: chip ±N (efeito persistente) · cleanNeg (limpa negativos do alvo)
  //     cleanCard (limpa TODAS as cartas do alvo) · groupNeg/groupAll (limpa em todas as fichas)
  //     kill (ceifa de verdade: mata o alvo) · collapse (Torre: metade da vida atual desaba)
  //     revive (Mundo/Julgamento: despertam quem está morto ou caído a 0)
  //     special: 'lovers' (escolha entre 2 cartas) | 'wheel' (d6 decide o valor)
  // dano (v1.24): só o INIMIGO leva 🗡 ferida — em aliado a carta faz apenas o que tem de bom.
  //     custo (v1.24): virar a carta contra o PRÓPRIO corpo queima 🕯 Vontade — é o preço da leitura.
  //     Dano NÃO mata: a 0 o alvo fica 🟥 CAÍDO. Só A Morte ceifa, só a Torre desaba metade.
  const CARTAS = [
    { id: 0,  nome: 'O Louco',          curto: 'Louco',    emoji: '🃏', pct: 7, fx: { chip: 1, dano: 2, custo: 1 },
      sig: 'Novos começos, liberdade, espontaneidade, inocência e fé cega no desconhecido.',
      desc: '(em vc ou aliado) <b>+1 em tudo</b> · contra ele mesmo cobra 🕯 <b>1 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b>. Salto no desconhecido: se um 1 aparecer na próxima rolagem, transforme o azar em cena — o Louco cai, mas aprende.' },
    { id: 1,  nome: 'O Mago',           curto: 'Mago',     emoji: '🎩', pct: 6, fx: { chip: 2, dano: 4, custo: 2 },
      sig: 'Poder pessoal, habilidade, manifestação, foco e capacidade de transformar ideias em realidade.',
      desc: '(em vc ou aliado) <b>+2 em tudo</b> · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b> — a vontade que molda a matéria também queima quem fica na frente.' },
    { id: 2,  nome: 'A Sacerdotisa',    curto: 'Sacerdotisa', emoji: '🦉', pct: 6, fx: { chip: 2, dano: 4, custo: 2 },
      sig: 'Intuição profunda, mistério, sabedoria oculta, paciência e conexão com o inconsciente.',
      desc: '(em vc ou aliado) <b>+2 em tudo</b>, e quem recebeu a carta percebe um segredo que estava debaixo do nariz do grupo · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b>.' },
    { id: 3,  nome: 'A Imperatriz',     curto: 'Imperatriz', emoji: '🌷', pct: 7, fx: { hp: 4, dano: 2, custo: 2 },
      sig: 'Fertilidade, abundância material e emocional, criatividade e conexão com a natureza.',
      desc: '(em vc ou aliado) cura <b>4 de Fôlego/Vitalidade</b> · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b> (vida que cresce rápido também estica demais). Colheita, não milagre.' },
    { id: 4,  nome: 'O Imperador',      curto: 'Imperador', emoji: '🏛️', pct: 5, fx: { chip: 1, cleanNeg: true, dano: 4, custo: 2 },
      sig: 'Autoridade, estrutura, estabilidade, disciplina e construção de bases sólidas.',
      desc: '(em vc ou aliado) cancela os efeitos negativos de carta no alvo e concede <b>+1</b> · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b> — a ordem conserta a casa, e cobra a anuidade.' },
    { id: 5,  nome: 'O Hierofante',     curto: 'Hierofante', emoji: '📜', pct: 6, fx: { san: 4, dano: 2, custo: 1 },
      sig: 'Tradição, espiritualidade, busca por ensinamentos superiores, mentores e instituições.',
      desc: '(em vc ou aliado) <b>+4 de Vontade/Linha</b> · contra ele mesmo cobra só 🕯 <b>1 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b> — conselho de quem já apanhou da vida antes.' },
    { id: 6,  nome: 'Os Enamorados',    curto: 'Enamorados', emoji: '💞', pct: 4, fx: { special: 'lovers' },
      sig: 'Escolhas cruciais, dualidade, livre-arbítrio, amor e alinhamento de valores profundos.',
      desc: 'O baralho se abre em DUAS cartas: escolha uma para se realizar. O efeito em aliado, o 🗡 dano no inimigo e o 🕯 preço cobrado dele mesmo são os da carta que você escolher — e não tem como saber o preço das duas antes.' },
    { id: 7,  nome: 'O Carro',          curto: 'Carro',    emoji: '🛞', pct: 5, fx: { chip: 2, dano: 6, custo: 3 },
      sig: 'Vitória, determinação, foco inabalável, controle sobre os impulsos e superação de obstáculos.',
      desc: '(em vc ou aliado) <b>+2 em tudo</b> · contra ele mesmo cobra 🕯 <b>3 de Vontade</b> · (em inimigo) 🗡 <b>6 de dano</b> — quem passa na frente leva a roda. Nesta cena nada de recuar.' },
    { id: 8,  nome: 'A Força',          curto: 'Força',    emoji: '🦁', pct: 5, fx: { chip: 2, dano: 6, custo: 3 },
      sig: 'Coragem, domínio próprio, paciência, compaixão e a força mansa que domina os instintos.',
      desc: '(em vc ou aliado) <b>+2 em tudo</b> · contra ele mesmo cobra 🕯 <b>3 de Vontade</b> · (em inimigo) 🗡 <b>6 de dano</b>. Controlar a fera é mais difícil que bater nela — mas dói igual.' },
    { id: 9,  nome: 'O Eremita',        curto: 'Eremita',  emoji: '🕯️', pct: 5, fx: { san: 2, chip: 1, dano: 2, custo: 1 },
      sig: 'Autoconhecimento, introspecção, busca interior, sabedoria e solidão construtiva.',
      desc: '(em vc ou aliado) <b>+2 de Vontade, +1 em tudo</b> · contra ele mesmo cobra 🕯 <b>1 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b> — a lanterna pequena mostra o degrau certo.' },
    { id: 10, nome: 'A Roda da Fortuna', curto: 'Roda',     emoji: '🎡', pct: 4, fx: { special: 'wheel', dano: 4, custo: 2 },
      sig: 'Ciclos da vida, mudanças inevitáveis, sorte, destino e reviravoltas.',
      desc: 'A sorte gira um d6: 1–2 → −2 · 3 → +1 · 4–5 → +2 · 6 → +3 na marca de quem recebe · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b> em quem estiver embaixo, azarada ou não a marca.' },
    { id: 11, nome: 'A Justiça',        curto: 'Justiça',  emoji: '⚖️', pct: 5, fx: { chip: 1, cleanNeg: true, dano: 4, custo: 2 },
      sig: 'Lei de causa e efeito (carma), verdade, imparcialidade, ética e decisões racionais.',
      desc: '(em vc ou aliado) cancela os negativos do alvo e dá <b>+1</b> se não havia nada sujo · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b> — a balança paga em dia, e a lâmina dela corta dos dois lados.' },
    { id: 12, nome: 'O Enforcado',      curto: 'Enforcado', emoji: '🙃', pct: 4, fx: { chip: -2, dano: 4, custo: 1 },
      sig: 'Pausa necessária, sacrifício, mudança de perspectiva e entrega (ver as coisas de outro ângulo).',
      desc: 'Carta dura para quem quer que seja: <b>−2 em tudo</b> em quem cair (aliado incluído) · contra ele mesmo cobra ainda 🕯 <b>1 de Vontade</b> · (em inimigo) os mesmos −2 somados a 🗡 <b>4 de dano</b>. Pendurado de cabeça para baixo, ele vê o que ninguém vê — ótima em inimigos.' },
    { id: 13, nome: 'A Morte',          curto: 'Morte',    emoji: '💀', pct: 3, fx: { kill: true, cleanCard: true },
      sig: 'Transformação profunda, fim de um ciclo, cortes necessários e renascimento inevitável.',
      desc: 'Ceifa de verdade, em QUALQUER alvo — aliado, inimigo ou ele mesmo: MATA. Não é 🗡 dano, é fim: nem precisa de barra de vida e não cobra 🕯 (o preço é a própria vida). Vida e sanidade a 0, marca ☠️ que só o mestre tira. Só O Mundo ou O Julgamento despertam. O que era, acabou.' },
    { id: 14, nome: 'A Temperança',     curto: 'Temperança', emoji: '🕊️', pct: 6, fx: { hp: 2, san: 2, cleanNeg: true, dano: 2, custo: 1 },
      sig: 'Equilíbrio, moderação, cura, harmonia e a alquimia de unir opostos com paciência.',
      desc: '(em vc ou aliado) <b>+2 de Fôlego, +2 de Vontade</b> e apaga os negativos de carta · contra ele mesmo cobra 🕯 <b>1 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b>. Alquimia tranquila — mas água em excesso também afoga.' },
    { id: 15, nome: 'O Diabo',          curto: 'Diabo',    emoji: '⛓️', pct: 4, fx: { chip: 2, dano: 8, custo: 4 },
      sig: 'Apegos materiais, sombras, ilusões de aprisionamento, vícios e paixões desmedidas.',
      desc: '(em vc ou aliado) <b>+2 em tudo</b> · contra ele mesmo cobra caro: 🕯 <b>4 de Vontade</b> · (em inimigo) 🗡 <b>8 de dano</b> — o maior do baralho. Poder emprestado com juros: quem abusa esquece de devolver (a mesa decide a cobrança).' },
    { id: 16, nome: 'A Torre',          curto: 'Torre',    emoji: '🌩️', pct: 2, fx: { chip: -3, collapse: true, custo: 1 },
      sig: 'Rupturas drásticas, revelações repentinas, libertação de falsas estruturas e colapso necessário.',
      desc: '<b>−3 em tudo</b> em quem cair (aliado incluído) e o chão cede: o alvo PERDE METADE da vida que tinha — esse é o dano dele, e por isso não usa número fixo (fica 🟥 CAÍDO a 0, mas não morto). Contra ele mesmo cobra ainda 🕯 <b>1 de Vontade</b>. Rara, e por isso dói.' },
    { id: 17, nome: 'A Estrela',        curto: 'Estrela',  emoji: '⭐', pct: 2, fx: { fullHeal: true, cleanNeg: true, dano: 2, custo: 2 },
      sig: 'Esperança, inspiração, fé no futuro, cura espiritual, paz e renovação.',
      desc: '(em vc ou aliado) CURA COMPLETA de verdade: volta com TODA a vida e TODA a sanidade, e perde os negativos de carta · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>2 de dano</b> — luz demais também cega, mas cuidado: você também enche a barra dele. Não levanta morto — por isso é rara (2%).' },
    { id: 18, nome: 'A Lua',            curto: 'Lua',      emoji: '🌕', pct: 5, fx: { chip: -1, dano: 4, custo: 1 },
      sig: 'Ilusão, medos subconscientes, intuição aguçada, confusão e segredos ocultos.',
      desc: 'Neblina nos olhos: <b>−1 em tudo</b> em quem cair (aliado incluído) · contra ele mesmo cobra 🕯 <b>1 de Vontade</b> · (em inimigo) os mesmos −1 somados a 🗡 <b>4 de dano</b>. Algo se esconde aqui, e a carta sabe o quê.' },
    { id: 19, nome: 'O Sol',            curto: 'Sol',      emoji: '☀️', pct: 2, fx: { chip: 3, hp: 2, dano: 4, custo: 3 },
      sig: 'Alegria, sucesso absoluto, vitalidade, clareza, otimismo e brilho pessoal.',
      desc: '(em vc ou aliado) <b>+3 em tudo, +2 de Fôlego</b> · contra ele mesmo cobra 🕯 <b>3 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b>. Brilha — mas sol a pino também cega e queima.' },
    { id: 20, nome: 'O Julgamento',     curto: 'Julgamento', emoji: '🎺', pct: 4, fx: { san: 2, groupNeg: true, revive: true, dano: 6, custo: 2 },
      sig: 'Despertar espiritual, autoavaliação, perdão, absolvição e o chamado para uma nova vida.',
      desc: 'Trombeta do grupo: limpa os negativos de carta de TODOS os heróis · (em vc ou aliado) <b>+2 de Vontade</b> no alvo · contra ele mesmo cobra 🕯 <b>2 de Vontade</b> · (em inimigo) 🗡 <b>6 de dano</b> no estrondo — e o CHAMADO desperta quem caiu: morto ou a 0, volta com metade da vida e da sanidade.' },
    { id: 21, nome: 'O Mundo',          curto: 'Mundo',    emoji: '🌍', pct: 3, fx: { chip: 1, groupAll: true, revive: true, dano: 4, custo: 3 },
      sig: 'Realização plena, conclusão bem-sucedida de um grande ciclo, integração e plenitude.',
      desc: 'Fim de ciclo: limpa TODAS as marcas de carta de todos os heróis · (em vc ou aliado) <b>+1</b> no alvo · contra ele mesmo cobra 🕯 <b>3 de Vontade</b> · (em inimigo) 🗡 <b>4 de dano</b> — e a plenitude reescreve o final: alvo morto ou a 0 volta com metade da vida e da sanidade.' }
  ];

  // ---------- Estado padrão ----------
  // Os 5 atributos têm o MESMO nome nas 3 fichas (só os valores mudam) —
  // senão na hora do mestre pedir "faz um teste de..." vira bagunça.
  const ATTR_NOMES = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', carisma: 'Carisma' };

  const defaultState = {
    hp: 22, hpMax: 22,        // Fôlego
    san: 100, sanMax: 100,    // Vontade
    status: [],
    armas: [],                // preparado p/ o mestre enviar armas depois
    log: [],
    lema: { nome: '“As cartas não decidem — elas emprestam coragem.”', desc: '' },
    inimigos: [ { nome: '', chips: [], morto: false, hp: 10, hpMax: 10 }, { nome: '', chips: [], morto: false, hp: 10, hpMax: 10 }, { nome: '', chips: [], morto: false, hp: 10, hpMax: 10 } ],
    atributos: {
      forca:        { nome: 'Força',        valor: 9 },
      destreza:     { nome: 'Destreza',     valor: 12 },
      constituicao: { nome: 'Constituição', valor: 11 },
      inteligencia: { nome: 'Inteligência', valor: 17 },
      carisma:      { nome: 'Carisma',      valor: 14 }
    }
  };

  let state = load();

  function load() {
    let merged;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      merged = raw ? Object.assign(JSON.parse(JSON.stringify(defaultState)), JSON.parse(raw)) : JSON.parse(JSON.stringify(defaultState));
    } catch (e) { merged = JSON.parse(JSON.stringify(defaultState)); }
    if (typeof merged.hp !== 'number') merged.hp = defaultState.hp;
    if (typeof merged.hpMax !== 'number') merged.hpMax = defaultState.hpMax;
    if (typeof merged.san !== 'number') merged.san = defaultState.san;
    if (typeof merged.sanMax !== 'number') merged.sanMax = defaultState.sanMax;
    if (!Array.isArray(merged.status)) merged.status = [];
    if (!Array.isArray(merged.armas)) merged.armas = [];
    if (!Array.isArray(merged.inimigos) || merged.inimigos.length !== 3) merged.inimigos = JSON.parse(JSON.stringify(defaultState.inimigos));
    merged.inimigos = merged.inimigos.map(function (e) {
      if (!e || typeof e !== 'object') return JSON.parse(JSON.stringify(defaultState.inimigos[0]));
      if (typeof e.nome !== 'string') e.nome = '';
      if (!Array.isArray(e.chips)) e.chips = [];
      if (typeof e.morto !== 'boolean') e.morto = false;
      // vida real nos slots: carta que dá dano agora baixa barra de inimigo
      if (typeof e.hpMax !== 'number' || e.hpMax < 1) e.hpMax = 10;
      if (typeof e.hp !== 'number') e.hp = e.hpMax;
      e.hpMax = Math.round(Math.max(1, Math.min(999, e.hpMax)));
      e.hp = Math.max(0, Math.min(e.hpMax, Math.round(e.hp)));
      return e;
    });
    if (!merged.lema || typeof merged.lema !== 'object') merged.lema = { nome: defaultState.lema.nome, desc: '' };
    if (!merged.atributos || typeof merged.atributos !== 'object') merged.atributos = JSON.parse(JSON.stringify(defaultState.atributos));
    normAttrs(merged.atributos);
    return merged;
  }
  // força a etiqueta canônica nos 5 atributos (mantém o valor que o jogador já tinha)
  function normAttrs(a) {
    Object.keys(ATTR_NOMES).forEach(function (k) {
      if (!a[k] || typeof a[k].valor !== 'number') a[k] = { nome: ATTR_NOMES[k], valor: defaultState.atributos[k].valor };
      a[k].nome = ATTR_NOMES[k];
    });
    return a;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

  const $ = (id) => document.getElementById(id);
  // bind seguro: um elemento faltando (cache antiga) não derruba a ficha inteira
  function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); }

  // ---------- Abas ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      const alvo = $('panel-' + btn.dataset.tab);
      if (alvo) alvo.classList.add('active');
    });
  });

  // ---------- Atributos (+ cartas como parcelas visíveis) ----------
  function mod(v) { return Math.max(0, Math.floor((v - 10) / 2)); }
  function fmtMod(m) { return (m >= 0 ? '+' : '−') + Math.abs(m); } // mesmo − (U+2212) das marcas de carta, sem misturar com hífen

  // Marca de carta: "emoji Nome · +N" — só esse formato soma nas rolagens
  function chipValue(txt) {
    const m = /·\s*([+−])\s*(\d+)$/.exec(String(txt || ''));
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * Math.min(3, parseInt(m[2], 10) || 0);
  }
  function isCardChip(txt) { return chipValue(txt) !== 0 || /·\s*[+−]\s*\d+$/.test(String(txt || '')); }
  function cardBonus() { return state.status.reduce(function (acc, s) { return acc + chipValue(s); }, 0); }
  function cardDetail() {
    let s = '';
    state.status.forEach(function (t) {
      const v = chipValue(t);
      if (v) s += (v > 0 ? ' + ' : ' − ') + Math.abs(v) + (String(t).split(' ')[0] || '🃏');
    });
    return s;
  }

  // ---------- Morto não age ----------
  // A ceifa é literal: quem está com a marca ☠️ não rola dado, não sorteia carta e não se cura sozinho.
  function estaMorto() { return state.status.indexOf(SHEETS.santiago.morto) !== -1; }
  function mortoBlock(box) {
    if (!estaMorto()) return false;
    if (box) box.textContent = '☠️ morto não age';
    const m = $('statusMsg');
    if (m) m.textContent = '☠️ ' + WHO + ' está MORTO — morto não rola nem se levanta. Só O Mundo 🌍, O Julgamento 🎺 ou o [Restaurar] do mestre.';
    activity(WHO, '⛔ tentou agir estando morto');
    return true;
  }

  function rollAttr(key, card) {
    const a = state.atributos[key]; if (!a) return;
    const resBox = card.querySelector('.attr-result');
    if (mortoBlock(resBox)) return;
    const v = a.valor;
    const m = v + cardBonus();
    const face = 1 + Math.floor(Math.random() * 10);
    const total = face + m;
    const det = cardDetail();
    if (resBox) resBox.textContent = '🎲 ' + face + ' + ' + v + det + ' = ' + total;
    card.classList.remove('rolled'); void card.offsetWidth; card.classList.add('rolled');
    let classe = '';
    if (face === 10) classe = 'log-crit';
    if (face === 1) classe = 'log-fumble';
    addRoll({ who: WHO, txt: 'Rolou ' + a.nome + ' · d10 ' + fmtMod(m) + det, total: total, detalhe: String(face), classe: classe });
  }

  function renderAttrs() {
    const grid = $('attrsGrid'); if (!grid) return;
    grid.innerHTML = '';
    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const card = document.createElement('div');
      card.className = 'attr-card';
      card.innerHTML =
        '<div class="attr-name">' + a.nome + '</div>' +
        '<input class="attr-value" type="number" min="0" max="30" value="' + a.valor + '" />' +
        '<div class="attr-mod">' + fmtMod(mod(a.valor)) + '</div>' +
        '<div class="attr-result"></div>' +
        '<div class="attr-hint">🎲 d10 + valor do Status (+ cartas ativas)</div>';
      const input = card.querySelector('input');
      input.addEventListener('input', function () {
        const n = parseInt(input.value, 10);
        if (isNaN(n)) return;
        a.valor = Math.max(0, Math.min(30, n));
        card.querySelector('.attr-mod').textContent = fmtMod(mod(a.valor));
        fillBonusOptions(); save();
      });
      input.addEventListener('blur', function () { input.value = a.valor; });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      card.addEventListener('click', function () { rollAttr(key, card); });
      grid.appendChild(card);
    });
    fillBonusOptions();
  }

  function fillBonusOptions() {
    const sel = $('attrBonus'); if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="none">nenhum atributo</option>';
    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = a.nome + ' (' + fmtMod(mod(a.valor)) + ')';
      sel.appendChild(opt);
    });
    sel.value = atual || 'none';
  }

  // ---------- Fôlego (HP) ----------
  function renderHP() {
    const fill = $('hpFill'), txt = $('hpText'); if (!fill || !txt) return;
    const pct = Math.max(0, Math.min(100, (state.hp / state.hpMax) * 100));
    fill.style.width = pct + '%';
    txt.textContent = state.hp + ' / ' + state.hpMax;
    fill.style.background = pct <= 25
      ? 'linear-gradient(90deg,#8a3a2f,#b34a3f)'
      : 'linear-gradient(90deg,var(--st-teal),#6cbfa4)';
  }
  on('hpDmg', 'click', function () { state.hp = Math.max(0, state.hp - (parseInt($('hpInput').value, 10) || 0)); renderHP(); save(); });
  on('hpHeal', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.hp = Math.min(state.hpMax, state.hp + (parseInt($('hpInput').value, 10) || 0)); renderHP(); save(); });
  on('hpMax', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.hp = state.hpMax; renderHP(); save(); });

  // ---------- Vontade (SAN) ----------
  function renderSAN() {
    const fill = $('sanFill'), txt = $('sanText'); if (!fill || !txt) return;
    const pct = Math.max(0, Math.min(100, (state.san / state.sanMax) * 100));
    fill.style.width = pct + '%';
    txt.textContent = state.san + ' / ' + state.sanMax;
    fill.style.background = pct <= 25
      ? 'linear-gradient(90deg,#6d5238,#8a6a4a)'
      : pct <= 55
        ? 'linear-gradient(90deg,#8a6a4a,#b3906a)'
        : 'linear-gradient(90deg,#b3906a,#c9ab8a)';
  }
  on('sanDmg', 'click', function () { state.san = Math.max(0, state.san - (parseInt($('sanInput').value, 10) || 0)); renderSAN(); save(); });
  on('sanHeal', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.san = Math.min(state.sanMax, state.san + (parseInt($('sanInput').value, 10) || 0)); renderSAN(); save(); });
  on('sanMax', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.san = state.sanMax; renderSAN(); save(); });

  // ---------- Efeitos ----------
  function renderStatus() {
    const box = $('statusChips'); if (!box) return;
    box.innerHTML = '';
    const count = $('statusCount'); if (count) count.textContent = state.status.length + '/' + STATUS_MAX;
    if (!state.status.length) { box.innerHTML = '<span class="chip empty">sem efeitos — cartas aplicadas aparecem aqui</span>'; return; }
    state.status.forEach(function (s, i) {
      const chip = document.createElement('span');
      const v = chipValue(s);
      const gm = GM_ONLY.indexOf(s) !== -1; // marca do mestre: o jogador não desfaz clicando
      chip.className = 'chip' + (gm ? ' gm' : (isCardChip(s) ? (v < 0 ? ' carta carta-neg' : ' carta') : ''));
      chip.title = gm ? 'Só o mestre desfaz isso' : (isCardChip(s) ? 'Descartar esta marca de carta' : 'Clique para remover');
      chip.textContent = s;
      chip.addEventListener('click', function () {
        if (gm) {
          const m = $('statusMsg');
          if (m) m.textContent = '☠️ ' + s + ' é marca do mestre — só o [Restaurar] dele, ou O Mundo / O Julgamento nas mãos do ' + WHO + '.';
          return;
        }
        state.status.splice(i, 1); renderStatus(); save();
      });
      box.appendChild(chip);
    });
  }
  function addStatus(nome) {
    nome = (nome || '').trim(); if (!nome) return '';
    if (state.status.length >= STATUS_MAX) return 'Limite de ' + STATUS_MAX + ' efeitos atingido.';
    if (state.status.indexOf(nome) !== -1) return '“' + nome + '” já está ativo.';
    state.status.push(nome); renderStatus(); save(); return 'Novo efeito: “' + nome + '”.';
  }
  on('statusAddBtn', 'click', function () { $('statusMsg').textContent = addStatus($('statusInput').value); $('statusInput').value = ''; });
  on('statusInput', 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('statusMsg').textContent = addStatus(this.value); this.value = ''; } });

  // ============================================================
  // ---------- TAROT — sorteio ponderado + alvos + aplicação ----------
  // ============================================================
  let drawn = null;        // carta em jogo
  let loversOpts = null;   // opção dupla dos Enamorados

  function chipTxt(c, v) { return c.emoji + ' ' + c.curto + ' · ' + (v > 0 ? '+' : '−') + Math.abs(v); }

  function weightedDraw() {
    let r = Math.floor(Math.random() * 100); // 0..99 · as % somam 100
    for (let i = 0; i < CARTAS.length; i++) {
      r -= CARTAS[i].pct;
      if (r < 0) return CARTAS[i];
    }
    return CARTAS[CARTAS.length - 1];
  }

  // mexe numa ficha salva (sem destruir os campos que não conhece)
  function withSheet(key, fn) {
    // a própria ficha dele está viva em memória — aplicar nele mesmo sempre funciona
    if (key === SAVE_KEY) {
      if (!Array.isArray(state.status)) state.status = [];
      fn(state);
      save();
      return state;
    }
    let s = null;
    try { const raw = localStorage.getItem(key); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return null;
    if (!Array.isArray(s.status)) s.status = [];
    fn(s);
    try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { return null; }
    return s;
  }

  // aplica a carta numa ficha de jogador (as 5 da mesa) → resume em partes
  function applyToSheet(sheet, c, fx) {
    const out = [];
    const saved = withSheet(sheet.key, function (s) {
      // limpezas primeiro (pra cura/buff não contar em cima de sujeira velha)
      if (fx.cleanCard) {
        const antes = s.status.length;
        s.status = s.status.filter(function (t) { return !isCardChip(t); });
        if (antes !== s.status.length) out.push('cortou ' + (antes - s.status.length) + ' marca(s) de carta');
      }
      if (fx.cleanNeg) {
        const antes = s.status.length;
        s.status = s.status.filter(function (t) { return !(isCardChip(t) && chipValue(t) < 0); });
        if (antes !== s.status.length) out.push('absolveu ' + (antes - s.status.length) + ' negativo(s)');
      }
      // O Julgamento / O Mundo: o chamado desperta quem caiu
      const dead = s.status.indexOf(sheet.morto) !== -1;
      if (fx.revive && (dead || (typeof s.hp === 'number' && s.hp <= 0))) {
        if (dead) s.status.splice(s.status.indexOf(sheet.morto), 1);
        if (typeof s.hp === 'number') {
          const hpMax = typeof s.hpMax === 'number' ? s.hpMax : 1;
          const sanMax = typeof s.sanMax === 'number' ? s.sanMax : 1;
          s.hp = Math.max(1, Math.ceil(hpMax / 2));
          s.san = Math.max(1, Math.ceil(sanMax / 2));
          out.push('↩️ ' + (dead ? 'DESPERTOU da morte' : 'levantou do chão') + ': ' + s.hp + ' de vida, ' + s.san + ' de sanidade');
        }
      }
      // A Torre: metade da vida que o alvo tem desaba (deixa CAÍDO, não morto)
      if (fx.collapse && typeof s.hp === 'number' && s.hp > 0 && s.status.indexOf(sheet.morto) === -1) {
        const perda = Math.max(1, Math.ceil(s.hp / 2));
        s.hp = Math.max(0, s.hp - perda);
        out.push('🌩️ o chão cedeu: −' + perda + ' de vida' + (s.hp === 0 ? ' · CAÍDO a 0 (ainda vivo)' : ''));
      }
      // A Estrela: esperança de verdade — vida e sanidade voltam ao teto (não levanta morto)
      if (fx.fullHeal && s.status.indexOf(sheet.morto) === -1) {
        const hpMax = typeof s.hpMax === 'number' ? s.hpMax : null;
        const sanMax = typeof s.sanMax === 'number' ? s.sanMax : null;
        const gano = (typeof s.hp === 'number' && hpMax !== null) ? hpMax - s.hp : 0;
        const gana = (typeof s.san === 'number' && sanMax !== null) ? sanMax - s.san : 0;
        if (typeof s.hp === 'number' && hpMax !== null) s.hp = hpMax;
        if (typeof s.san === 'number' && sanMax !== null) s.san = sanMax;
        out.push((gano + gana) > 0
          ? '⭐ CURA COMPLETA: +' + gano + ' de vida (' + s.hp + '/' + hpMax + ') e +' + gana + ' de sanidade (' + s.san + '/' + sanMax + ')'
          : '⭐ já estava inteira — nada a curar');
      }
      if (typeof fx.hp === 'number' && typeof s.hp === 'number') {
        const max = typeof s.hpMax === 'number' ? s.hpMax : s.hp;
        const novo = Math.max(0, Math.min(max, s.hp + fx.hp));
        const d = novo - s.hp;
        out.push(d === 0
          ? (fx.hp >= 0 ? 'vida já estava no teto' : 'vida já estava no fundo')
          : (d > 0 ? '+' : '−') + Math.abs(d) + ' de vida (enchimento/fôlego)');
        s.hp = novo;
      }
      if (typeof fx.san === 'number' && typeof s.san === 'number') {
        const max = typeof s.sanMax === 'number' ? s.sanMax : s.san;
        const novo = Math.max(0, Math.min(max, s.san + fx.san));
        const d = novo - s.san;
        out.push(d === 0
          ? (fx.san >= 0 ? 'sanidade já estava cheia' : 'sanidade já estava no chão')
          : (d > 0 ? '+' : '−') + Math.abs(d) + ' de sanidade/linha');
        s.san = novo;
      }
      if (fx.chip) {
        const txt = chipTxt(c, fx.chip);
        s.status = s.status.filter(function (t) { return t.indexOf(c.emoji + ' ' + c.curto + ' ·') !== 0; }); // renova, não empilha
        if (s.status.length >= STATUS_MAX) out.push('efeito ' + txt + ' não coube (6 marcas no alvo)');
        else { s.status.push(txt); out.push(txt); }
      }
      // v1.24: o preço de virar a carta contra o PRÓPRIO corpo — só ele paga, e paga em Vontade.
      // 🗡 dano é coisa de INIMIGO (applyToEnemy): em aliado a carta deixa só o que tem de bom.
      const ele = sheet.key === SAVE_KEY;
      if (ele && fx.custo > 0 && typeof s.san === 'number' && s.status.indexOf(sheet.morto) === -1) {
        const max = typeof s.sanMax === 'number' ? s.sanMax : s.san;
        const antes = s.san;
        s.san = Math.max(0, s.san - fx.custo);
        const pago = antes - s.san;
        out.push(pago === 0
          ? '🕯 cobrava ' + fx.custo + ' de Vontade, mas a mente dele já estava no chão (0/' + max + ')'
          : '🕯 virou a carta contra si mesmo: −' + pago + ' de Vontade' + (pago < fx.custo ? ' (só tinha ' + antes + ')' : '') + ' (fica ' + s.san + '/' + max + ')');
      }
      // A Morte por último: nenhuma cura da mesma carta segura a ceifa
      if (fx.kill) {
        s.status = s.status.filter(function (t) {
          return t !== sheet.morto && t !== sheet.incap && t !== '🟡 Incapacitado' && t !== '🟡 Incapacitada';
        });
        s.hp = 0; s.san = 0;
        s.status.unshift(sheet.morto);
        if (s.status.length > STATUS_MAX) s.status.length = STATUS_MAX;
        out.push('☠️ CEIFOU — ' + sheet.nome + ' está ' + sheet.caiu + ' (vida e sanidade a 0; só O Mundo, O Julgamento ou o mestre devolvem)');
      }
    });
    if (!saved) return null;
    return out;
  }

  // está ceifado de verdade? (só a marca de morte conta — caído a 0 ainda recebe cura)
  function sheetIsDead(tid) {
    const sh = SHEETS[tid]; if (!sh) return false;
    if (tid === 'santiago') return state.status.indexOf(sh.morto) !== -1;
    let s = null;
    try { const raw = localStorage.getItem(sh.key); if (raw) s = JSON.parse(raw); } catch (e) { return false; }
    return !!s && Array.isArray(s.status) && s.status.indexOf(sh.morto) !== -1;
  }

  // aplica num inimigo (caderno dele: marca ±N e a BARRA DE VIDA própria — é o ÚNICO alvo que leva 🗡 dano)
  function applyToEnemy(idx, c, fx) {
    const e = state.inimigos[idx];
    const out = [];
    const nome = e.nome || ('inimigo ' + (idx + 1));
    const ver = function () { return e.hp + '/' + e.hpMax; };
    if (fx.kill) {
      e.chips = [];
      e.hp = 0;
      e.morto = true;
      out.push('☠️ CEIFOU — ' + nome + ' caiu morto na hora (barra a 0). Só O Mundo / O Julgamento (ou o mestre) decidem se volta.');
      return out;
    }
    if (fx.revive && (e.morto || e.hp <= 0)) {
      const eraMorto = e.morto;
      e.morto = false;
      e.hp = Math.max(1, Math.ceil(e.hpMax / 2));
      out.push('↩️ ' + (eraMorto ? 'DESPERTOU da morte' : 'levantou do chão') + ': ' + ver() + ' de vida');
    }
    if (fx.cleanCard || fx.cleanNeg) {
      const antes = e.chips.length;
      e.chips = e.chips.filter(function (t) {
        if (fx.cleanCard) return false;
        return !(chipValue(t) < 0);
      });
      if (antes !== e.chips.length) out.push('perdeu ' + (antes - e.chips.length) + ' marca(s)');
    }
    if (!e.morto) {
      if (fx.collapse && e.hp > 0) {
        const perda = Math.max(1, Math.ceil(e.hp / 2));
        e.hp = Math.max(0, e.hp - perda);
        out.push('🌩️ a torre dele desabou: −' + perda + ' de vida (' + ver() + ')' + (e.hp === 0 ? ' · 🟥 CAÍDO' : ''));
      }
      if (typeof fx.hp === 'number' && fx.hp !== 0) {
        const antes = e.hp;
        e.hp = Math.max(0, Math.min(e.hpMax, e.hp + fx.hp));
        const d = e.hp - antes;
        out.push(d === 0
          ? (fx.hp > 0 ? 'a vida dele já estava no teto' : 'a vida dele já estava no chão')
          : (fx.hp > 0
            ? '+' + d + ' de vida nele — você acabou de CURAR o inimigo (' + ver() + ')'
            : '−' + Math.abs(d) + ' de vida (' + ver() + ')' + (e.hp === 0 ? ' · 🟥 CAÍDO' : '')));
      }
      if (fx.fullHeal) {
        const antes = e.hp;
        e.hp = e.hpMax;
        out.push(antes === e.hpMax ? '⭐ a barra dele já estava cheia' : '⭐ você ENCHEU a vida do inimigo: ' + ver() + ' — jogada ou erro?');
      }
      if (fx.dano > 0) {
        const antes = e.hp;
        e.hp = Math.max(0, e.hp - fx.dano);
        const sofreu = antes - e.hp;
        out.push(sofreu === 0
          ? '🗡 ' + fx.dano + ' de dano e ele já estava no chão (0/' + e.hpMax + ')'
          : '🗡 ' + sofreu + ' de dano em ' + nome + (sofreu < fx.dano ? ' (só tinha ' + antes + ')' : '') + ' (fica ' + ver() + ')'
            + (e.hp === 0 ? ' · 🟥 CAÍDO — ainda vivo, levanta com cura, O Mundo ou O Julgamento' : ''));
      }
    }
    if (fx.chip) {
      const txt = chipTxt(c, fx.chip);
      e.chips = e.chips.filter(function (t) { return t.indexOf(c.emoji + ' ' + c.curto + ' ·') !== 0; });
      if (e.chips.length >= STATUS_MAX) out.push('inimigo já está cheio de marcas');
      else { e.chips.push(txt); out.push(txt); }
    }
    return out;
  }

  function targetLabel(tid) {
    if (SHEETS[tid]) return SHEETS[tid].nome;
    if (tid.charAt(0) === 'e') {
      const e = state.inimigos[+tid.charAt(1)];
      if (!e) return tid;
      return '👤 ' + (e.nome ? e.nome : 'inimigo ' + (+tid.charAt(1) + 1))
        + (e.morto ? ' ☠️' : ' (' + e.hp + '/' + e.hpMax + ')' + (e.hp === 0 ? ' 🟥' : ''));
    }
    return tid;
  }

  function applyCard(c, tid) {
    let fx = Object.assign({}, c.fx);
    // Roda da Fortuna: o d6 decide o valor da marca (o dano e o preço dele mesmo são fixos da carta)
    if (fx.special === 'wheel') {
      const d6 = 1 + Math.floor(Math.random() * 6);
      const v = d6 <= 2 ? -2 : (d6 === 3 ? 1 : (d6 <= 5 ? 2 : 3));
      fx = {
        chip: v,
        dano: (typeof c.fx.dano === 'number' ? c.fx.dano : 0),
        custo: (typeof c.fx.custo === 'number' ? c.fx.custo : 0)
      };
      const r = execApply(c, tid, fx);
      if (Array.isArray(r)) r.unshift('🎡 d6 = ' + d6);
      return r;
    }
    if (fx.special === 'lovers') return null; // tratado antes, com escolha
    return execApply(c, tid, fx);
  }
  // retorna: array(parte do efeito) · null(ficha não existe) · string ⛔(bloqueado, carta segue na mesa)
  function execApply(c, tid, fx) {
    if (!SHEETS[tid] && tid.charAt(0) !== 'e') return '⛔ alvo inválido — escolha um alvo na lista.';
    // corpo ceifado não leva buff — só a própria Morte (repetida) e os despertares
    if (tid.charAt(0) === 'e') {
      const e = state.inimigos[+tid.charAt(1)];
      if (e && e.morto && !fx.kill && !fx.revive) {
        return '⛔ ' + targetLabel(tid) + ' já caiu morto — escolha outro alvo (a carta continua na mesa).';
      }
    } else if (!fx.kill && !fx.revive && sheetIsDead(tid)) {
      return '⛔ ' + SHEETS[tid].nome + ' está ' + SHEETS[tid].caiu + ' — buff nenhum acorda um corpo. Só O Mundo 🌍, O Julgamento 🎺 ou o [Restaurar] do mestre. (A carta continua na mesa.)';
    }
    // limpezas em grupo varrem todas as fichas da lista antes do efeito individual
    if (fx.groupNeg || fx.groupAll) {
      Object.keys(SHEETS).forEach(function (k) {
        applyToSheet(SHEETS[k], c, { cleanCard: fx.groupAll, cleanNeg: !fx.groupAll });
      });
    }
    const own = Object.assign({}, fx); delete own.groupNeg; delete own.groupAll;
    let parts = null;
    if (tid.charAt(0) === 'e') {
      parts = applyToEnemy(+tid.charAt(1), c, own);
      save(); // inimigos são caderno dele: a marca precisa sobreviver ao reload
    } else {
      parts = applyToSheet(SHEETS[tid], c, own);
    }
    if (parts === null) return null; // ficha-alvo não existe neste navegador
    refreshFromStorage(); // relê o que salvou (inclusive a limpeza em grupo)
    if (fx.groupNeg) parts.unshift('absolveu os negativos do grupo inteiro');
    if (fx.groupAll) parts.unshift('zerou as marcas de carta do grupo inteiro');
    return parts;
  }
  function refreshFromStorage() {
    state = load();
    renderHP(); renderSAN(); renderStatus(); renderEnemies();
    buildTargetSelect(); // a lista mostra a vida de cada slot: sem isso ela ficava velha depois do dano
  }

  // Esconder E esvazia: com carta velha dentro, o painel dos Enamorados ainda guardava cliques mortos.
  function hideLovers() {
    const lp = $('loversPick');
    if (!lp) return;
    lp.hidden = true;
    lp.innerHTML = '';
  }

  // ---------- UI do sorteio ----------
  function setCardFace(c) {
    const box = $('drawnCard');
    if (!c) {
      box.classList.remove('flipped', 'pulse');
      $('cardEmoji').textContent = '🃏';
      $('cardNome').textContent = '—';
      $('cardSig').textContent = 'o baralho espera';
      $('cardEfeito').textContent = 'Corte o baralho e consulte. O destino comparece pontualmente — e cobra juros.';
      return;
    }
    $('cardEmoji').textContent = c.emoji;
    $('cardNome').textContent = c.nome;
    $('cardSig').textContent = c.sig;
    $('cardEfeito').innerHTML = '<b>Efeito:</b> ' + c.desc;
    void box.offsetWidth;
    box.classList.add('flipped');
    box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
    document.querySelectorAll('.deck-card').forEach(function (d) { d.classList.toggle('just-drawn', +d.dataset.id === c.id); });
  }

  function buildTargetSelect() {
    const sel = $('tarotAlvo'); if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '';
    Object.keys(SHEETS).forEach(function (k) {
      const sh = SHEETS[k];
      const o = document.createElement('option');
      o.value = k;
      o.textContent = (sh.emoji ? sh.emoji + ' ' : '🤝 ') + sh.nome + (k === 'santiago' ? ' (ele mesmo)' : ' (aliado)');
      sel.appendChild(o);
    });
    state.inimigos.forEach(function (e, i) {
      const o = document.createElement('option');
      o.value = 'e' + i;
      o.textContent = '👤 ' + (e.nome || 'Inimigo ' + (i + 1)) + ' · ' + e.hp + '/' + e.hpMax + (e.morto ? ' ☠️' : (e.hp === 0 ? ' 🟥' : '')) + ' (inimigo)';
      sel.appendChild(o);
    });
    if (atual) sel.value = atual;
  }

  function resetDraw() {
    drawn = null; loversOpts = null;
    setCardFace(null);
    hideLovers();
    const ap = $('tarotAplicar'); if (ap) ap.disabled = true;
    const ds = $('tarotDescartar'); if (ds) ds.disabled = true;
    document.querySelectorAll('.deck-card').forEach(function (d) { d.classList.remove('just-drawn'); });
  }

  on('tarotSortear', 'click', function () {
    if (mortoBlock($('tarotMsg'))) return;
    const c = weightedDraw();
    drawn = c; loversOpts = null;
    hideLovers(); // se os Enamorados estavam abertos, eles somem antes da carta nova
    setCardFace(c);
    $('tarotDescartar').disabled = false;
    if (c.fx.special === 'lovers') {
      // Duas cartas candidatas; Enamorados não se escolhem a si mesmos (senão vira piada infinita)
      const a = (function pick() { const x = weightedDraw(); return x.fx.special === 'lovers' ? pick() : x; })();
      const b = (function pick() { const x = weightedDraw(); return (x.fx.special === 'lovers' || x.id === a.id) ? pick() : x; })();
      loversOpts = [a, b];
      const lp = $('loversPick'); lp.hidden = false; lp.innerHTML = '';
      const note = document.createElement('p'); note.className = 'lp-note';
      note.textContent = '💞 Dois caminhos se abrem. Escolha QUAL carta se realiza:';
      lp.appendChild(note);
      loversOpts.forEach(function (x) {
        const card = document.createElement('div'); card.className = 'lp-card';
        card.innerHTML = '<span>' + x.emoji + '</span><b>' + x.nome + '</b><small>' + x.desc + '</small>';
        card.addEventListener('click', function () { doApply(x); });
        lp.appendChild(card);
      });
      $('tarotAplicar').disabled = true; // precisa escolher
      $('tarotMsg').textContent = 'Os Enamorados aguardam sua decisão.';
    } else {
      $('tarotAplicar').disabled = false;
      $('tarotMsg').textContent = '';
    }
    addRoll({ who: WHO, txt: '🂠 sorteou ' + c.nome + ' (' + c.pct + '%)', total: '✦', detalhe: c.sig });
  });

  on('tarotAplicar', 'click', function () { if (drawn && drawn.fx.special !== 'lovers') doApply(drawn); });
  on('tarotDescartar', 'click', function () {
    if (!drawn) return;
    activity(WHO, '🗑 descartou ' + drawn.nome + ' sem aplicar');
    $('tarotMsg').textContent = 'Ele devolveu ' + drawn.nome + ' ao baralho. Algumas respostas a gente não quer.';
    resetDraw();
  });

  function doApply(c) {
    const tid = $('tarotAlvo').value || 'santiago';
    const parts = applyCard(c, tid);
    if (parts === null) {
      $('tarotMsg').textContent = '⚠ a ficha de ' + targetLabel(tid) + ' ainda não foi salva neste navegador — aplique em outro alvo (o sorteio continua valendo).';
      return;
    }
    if (typeof parts === 'string') { // bloqueado: a carta segue na mesa, não é gasta
      $('tarotMsg').textContent = parts;
      return;
    }
    const resumo = parts.length ? parts.join(' · ') : 'sem efeito prático';
    $('tarotMsg').textContent = c.emoji + ' ' + c.nome + ' → ' + targetLabel(tid) + ': ' + resumo;
    addRoll({ who: WHO, txt: c.emoji + ' ' + c.nome + ' → ' + targetLabel(tid) + ' · ' + resumo, total: '🂠', detalhe: c.curto });
    activity(WHO, c.emoji + ' aplicou ' + c.nome + ' em ' + targetLabel(tid));
    resetDraw();
  }

  // ---------- Baralho (grade de consulta) ----------
  function renderDeck() {
    const grid = $('deckGrid'); if (!grid) return;
    grid.innerHTML = '';
    CARTAS.forEach(function (c) {
      const d = document.createElement('div');
      d.className = 'deck-card'; d.dataset.id = c.id;
      d.innerHTML = '<span class="dc-emoji">' + c.emoji + '</span><span class="dc-nome">' + c.nome + '</span><span class="dc-pct">' + c.pct + '%</span>';
      d.addEventListener('click', function () {
        $('cardInfo').innerHTML = '<b>' + c.id + ' · ' + c.nome + '</b> (' + c.pct + '% de vir) — <i>' + c.sig + '</i><br><b>Efeito:</b> ' + c.desc;
      });
      grid.appendChild(d);
    });
  }

  // ---------- Inimigos (3 slots nomeáveis, com vida própria + marcas clicáveis) ----------
  function clampInt(v, min, max) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function renderEnemies() {
    const list = $('enemyList'); if (!list) return;
    list.innerHTML = '';
    state.inimigos.forEach(function (e, i) {
      const row = document.createElement('div');
      row.className = 'enemy-row' + (e.morto ? ' dead' : (e.hp === 0 ? ' caido' : ''));
      const inp = document.createElement('input');
      inp.type = 'text'; inp.maxlength = 22; inp.value = e.nome;
      inp.placeholder = 'inimigo ' + (i + 1) + ' — nomeie…';
      inp.addEventListener('input', function () { e.nome = inp.value.trim(); buildTargetSelect(); save(); });
      row.appendChild(inp);

      // barra de vida dele: é aqui que o dano das cartas aparece (e onde você marca o golpe da mesa)
      const hpBox = document.createElement('div'); hpBox.className = 'enemy-hp';
      const bar = document.createElement('div'); bar.className = 'hp-bar enemy-bar';
      const fill = document.createElement('div');
      fill.className = 'hp-fill enemy-fill'; // a 0 a barra fica só com o trilho vazio mesmo
      fill.style.width = Math.round((e.hp / e.hpMax) * 100) + '%';
      bar.appendChild(fill);
      const leitura = document.createElement('span'); leitura.className = 'ehp-txt';
      leitura.textContent = e.hp + ' / ' + e.hpMax;
      bar.appendChild(leitura);
      hpBox.appendChild(bar);
      const cur = document.createElement('input');
      cur.type = 'number'; cur.min = '0'; cur.max = String(e.hpMax); cur.step = '1'; cur.value = e.hp;
      cur.title = 'vida atual dele — marque aqui o golpe que a mesa der';
      cur.addEventListener('change', function () { e.hp = clampInt(cur.value, 0, e.hpMax); save(); renderEnemies(); buildTargetSelect(); });
      const mx = document.createElement('input');
      mx.type = 'number'; mx.min = '1'; mx.max = '999'; mx.step = '1'; mx.value = e.hpMax;
      mx.title = 'vida máxima dele';
      mx.addEventListener('change', function () {
        e.hpMax = clampInt(mx.value, 1, 999);
        if (e.hp > e.hpMax) e.hp = e.hpMax;
        save(); renderEnemies(); buildTargetSelect();
      });
      const lb = document.createElement('span'); lb.className = 'ehp-lb'; lb.textContent = 'vida';
      hpBox.appendChild(lb); hpBox.appendChild(cur); hpBox.appendChild(mx);
      row.appendChild(hpBox);

      const chips = document.createElement('div'); chips.className = 'enemy-chips';
      if (e.morto) {
        const d = document.createElement('span');
        d.className = 'chip gm morte'; d.textContent = '☠️ Morto';
        d.title = 'Clique para este slot voltar a ser um inimigo vivo (ele levanta com metade da vida)';
        d.addEventListener('click', function () { e.morto = false; e.hp = Math.max(1, Math.ceil(e.hpMax / 2)); renderEnemies(); buildTargetSelect(); save(); });
        chips.appendChild(d);
      } else if (e.hp === 0) {
        const c0 = document.createElement('span');
        c0.className = 'chip caido'; c0.textContent = '🟥 Caído';
        c0.title = 'No chão, mas vivo: cura, O Mundo ou O Julgamento levantam ele. Dano extra não faz nada.';
        chips.appendChild(c0);
      } else if (!e.chips.length) {
        const s0 = document.createElement('span'); s0.className = 'chip empty'; s0.textContent = 'sem marcas'; chips.appendChild(s0);
      }
      e.chips.forEach(function (t, j) {
        const chip = document.createElement('span');
        chip.className = 'chip' + (chipValue(t) < 0 ? ' carta-neg' : ' carta');
        chip.title = 'Clique para retirar a marca';
        chip.textContent = t;
        chip.addEventListener('click', function () { e.chips.splice(j, 1); renderEnemies(); save(); });
        chips.appendChild(chip);
      });
      row.appendChild(chips);
      list.appendChild(row);
    });
  }

  // ---------- Lema + História (persistência por blur) ----------
  (function () {
    /* Migração do nome: ele se chamava Santiago. Os textos editáveis são salvos no
       navegador dele, e o que está salvo ganha do que está escrito no HTML — então
       trocar o nome no arquivo não trocaria o que ele vê. A troca varre só a palavra
       sozinha: qualquer outra edição que ele fez por cima fica intacta. */
    function renomeia(txt) { return String(txt).replace(/\bSantiago\b/g, 'Dante'); }
    let mexeu = false;
    const oN = $('obsNome'), oD = $('obsDesc');
    if (oN && oD) {
      if (state.lema.nome) oN.textContent = state.lema.nome;
      if (state.lema.desc) oD.textContent = state.lema.desc;
      const novoN = renomeia(oN.textContent), novoD = renomeia(oD.textContent);
      if (novoN !== oN.textContent || novoD !== oD.textContent) {
        oN.textContent = novoN; oD.textContent = novoD;
        state.lema.nome = novoN.trim(); state.lema.desc = novoD.trim();
        mexeu = true;
      }
      oN.addEventListener('blur', function () { state.lema.nome = oN.textContent.trim(); save(); });
      oD.addEventListener('blur', function () { state.lema.desc = oD.textContent.trim(); save(); });
    }
    const story = $('storyText');
    if (story) {
      const stored = localStorage.getItem(STORY_KEY);
      if (stored) {
        const nova = renomeia(stored);
        story.textContent = nova;
        if (nova !== stored) localStorage.setItem(STORY_KEY, nova);
      }
      story.addEventListener('blur', function () { localStorage.setItem(STORY_KEY, story.textContent); });
    }
    if (mexeu) save();
  })();

  // ---------- Inventário (armas enviadas pelo mestre · dano rola aqui, cartas somam) ----------
  function parseDice(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (m) {
      const qtde = m[1] === '' ? 1 : parseInt(m[1], 10);
      const faces = parseInt(m[2], 10);
      if (!faces) return null;
      return { qtde: qtde, faces: faces, bonus: m[3] ? parseInt(m[3], 10) : 0 };
    }
    const f = s.match(/^([+-]?\d+)$/);
    if (f) return { qtde: 0, faces: 0, bonus: parseInt(f[1], 10) || 0 };
    return null;
  }
  function rollWeapon(w, li) {
    const d = parseDice(w.dano);
    const out = li.querySelector('.weapon-result');
    if (mortoBlock(out)) return;
    if (!d) { out.textContent = '⚠ o mestre precisa definir um dano (ex: d8+2).'; return; }
    const cb = cardBonus(); // cartas aplicadas nele mesmo entram no dano
    let total, faceTxt, crit = false, fumble = false;
    if (d.qtde >= 1) {
      const r = rollDice(d.faces, d.qtde, d.bonus + cb);
      total = r.total; faceTxt = r.resultados.join(' + ');
      if (d.qtde === 1 && d.faces === 20) { crit = r.resultados[0] === 20; fumble = r.resultados[0] === 1; }
    } else {
      total = d.bonus + cb; faceTxt = 'dano fixo';
    }
    const det = cardDetail();
    out.textContent = '🎲 ' + faceTxt + (d.bonus ? (d.bonus >= 0 ? ' + ' + d.bonus : ' − ' + -d.bonus) : '') + det + ' = ' + total + ' de dano';
    out.classList.remove('show'); void out.offsetWidth; out.classList.add('show');
    addRoll({ who: WHO, txt: 'Dano · ' + w.nome + ' (' + (w.dano || '—') + ')' + det, total: total, detalhe: faceTxt, classe: crit ? 'crit' : (fumble ? 'fumble' : '') });
  }
  function renderInv() {
    const area = $('invArea');
    if (!area) return;
    if (!Array.isArray(state.armas) || !state.armas.length) return; // mantém a mensagem de vazio do HTML
    while (area.firstChild) area.removeChild(area.firstChild);
    const ul = document.createElement('ul');
    ul.className = 'weapon-list';
    state.armas.forEach(function (w) {
      const li = document.createElement('li');
      li.className = 'weapon-item';
      const name = document.createElement('span');
      name.className = 'w-name'; name.textContent = '⚔ ' + w.nome;
      const dice = document.createElement('span');
      dice.className = 'w-dice'; dice.textContent = w.dano || '—';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'mini-btn w-roll'; btn.textContent = '🎲 Rolar';
      btn.addEventListener('click', function () { rollWeapon(w, li); });
      const actions = document.createElement('div');
      actions.className = 'w-actions'; actions.appendChild(dice); actions.appendChild(btn);
      const res = document.createElement('p');
      res.className = 'weapon-result';
      li.appendChild(name); li.appendChild(actions); li.appendChild(res);
      ul.appendChild(li);
    });
    area.appendChild(ul);
  }

  // ---------- Histórico compartilhado (global) ----------
  function readRolls() { try { var l = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeRolls(l) { try { localStorage.setItem(ROLL_KEY, JSON.stringify(l)); } catch (e) {} }
  function normClasse(c) { c = String(c || ''); if (c.indexOf('crit') !== -1) return 'crit'; if (c.indexOf('fumble') !== -1) return 'fumble'; return ''; }
  function addRoll(entry) {
    const list = readRolls();
    list.unshift({
      who: entry.who || WHO, txt: entry.txt || 'Rolagem', total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '', classe: normClasse(entry.classe),
      hora: entry.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now()
    });
    writeRolls(list.slice(0, ROLL_MAX));
    renderLog();
  }
  function renderLog() {
    const ul = $('rollLog'); if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    const list = readRolls();
    if (!list.length) { const li0 = document.createElement('li'); li0.className = 'log-empty'; li0.textContent = 'Nenhuma rolagem ainda.'; ul.appendChild(li0); return; }
    list.forEach(function (l) {
      const li = document.createElement('li');
      const main = document.createElement('span');
      if (l.classe === 'crit') main.className = 'log-crit'; else if (l.classe === 'fumble') main.className = 'log-fumble';
      const who = document.createElement('span'); who.className = 'log-who' + (l.who === 'Mestre' ? ' mestre' : ''); who.textContent = l.who || WHO;
      const b = document.createElement('b'); b.textContent = l.txt;
      const det = document.createElement('span'); det.className = 'log-detail'; det.textContent = '[' + (l.detalhe != null ? l.detalhe : '') + ']';
      main.appendChild(who); main.appendChild(b); main.appendChild(document.createTextNode(' → ')); main.appendChild(det);
      const tot = document.createElement('span'); tot.className = 'log-total'; tot.textContent = String(l.total);
      const hora = document.createElement('small'); hora.textContent = ' · ' + l.hora; tot.appendChild(hora);
      li.appendChild(main); li.appendChild(tot); ul.appendChild(li);
    });
  }

  // ---------- Rolador d20 (gerais) ----------
  function rollDice(tipo, qtde, bonus) {
    const resultados = []; let soma = 0;
    for (let i = 0; i < qtde; i++) { const r = 1 + Math.floor(Math.random() * tipo); resultados.push(r); soma += r; }
    return { resultados: resultados, total: soma + bonus, bonus: bonus };
  }
  on('rollBtn', 'click', function () {
    if (mortoBlock($('rollMsg'))) return;
    const tipo = parseInt($('diceType').value, 10);
    const qtde = Math.max(1, Math.min(10, parseInt($('diceQty').value, 10) || 1));
    const attrKey = $('attrBonus').value;
    const bonus = (attrKey === 'none' ? 0 : mod(state.atributos[attrKey].valor)) + cardBonus();
    const die = $('die');
    die.classList.remove('crit', 'fumble', 'spinning'); void die.offsetWidth; die.classList.add('spinning');
    setTimeout(function () {
      const r = rollDice(tipo, qtde, bonus);
      die.textContent = String(r.total);
      const natural = r.resultados[0];
      const det = cardDetail();
      let msg = 'Total: ' + r.total + (bonus ? ' (' + (r.total - bonus) + ' ' + fmtMod(bonus) + (det ? ' ' + det.trim() : '') + ')' : '');
      let classe = '';
      if (tipo === 20 && qtde === 1 && (attrKey === 'none')) {
        if (natural === 20) { msg = '✦ Acerto crítico! Até o baralho aplaudiu de pé.'; classe = 'crit'; die.classList.add('crit'); }
        if (natural === 1) { msg = '✧ Falha crítica… a carta caiu de cabeça para baixo.'; classe = 'fumble'; die.classList.add('fumble'); }
      }
      $('rollMsg').textContent = msg;
      addRoll({
        who: WHO,
        txt: (attrKey !== 'none' ? state.atributos[attrKey].nome + ' · ' : '') + 'd' + tipo + (qtde > 1 ? '×' + qtde : '') + (bonus ? (bonus >= 0 ? ' + ' + bonus : ' − ' + -bonus) : ''),
        total: r.total, detalhe: r.resultados.join(', '), classe: classe
      });
    }, 550);
  });

  // ---------- Retrato (upload + editor de enquadramento com arrastar/zoom) ----------
  (function () {
    const portraitEl = $('portrait'), portraitImg = $('portraitImg'), portraitHint = $('portraitHint');
    const fileEl = $('portraitFile'), removeBtn = $('portraitRemove');
    if (!portraitEl || !portraitImg || !fileEl) return;
    const STAGE_SIZE = 280;  // diâmetro do círculo no editor

    let portraitData = null; // { src, zoom, panX, panY } — pan em fração do círculo
    function applyFraming(el, box, p, nat) {
      if (!el || !nat || !nat.w || !nat.h) return;
      const cover = Math.max(box / nat.w, box / nat.h);
      const s = cover * (p.zoom || 1);
      el.style.width = Math.round(nat.w * s) + 'px';
      el.style.height = Math.round(nat.h * s) + 'px';
      el.style.left = Math.round((box - nat.w * s) / 2 + (p.panX || 0) * box) + 'px';
      el.style.top = Math.round((box - nat.h * s) / 2 + (p.panY || 0) * box) + 'px';
    }
    function renderPortrait() {
      if (!portraitData || !portraitData.src) {
        portraitEl.classList.remove('has-img');
        portraitImg.removeAttribute('src');
        portraitImg.hidden = true;
        if (removeBtn) removeBtn.hidden = true;
        if (portraitHint) portraitHint.textContent = '✦ clicar para carregar imagem ✦';
        return;
      }
      portraitImg.onload = function () {
        applyFraming(portraitImg, portraitEl.clientWidth, portraitData, { w: portraitImg.naturalWidth, h: portraitImg.naturalHeight });
      };
      portraitImg.src = portraitData.src;
      portraitImg.hidden = false;
      portraitEl.classList.add('has-img');
      if (removeBtn) removeBtn.hidden = false;
      if (portraitHint) portraitHint.textContent = '✦ clicar para ajustar ✦';
    }
    function savePortrait() {
      if (!portraitData) { localStorage.removeItem(PORTRAIT_KEY); return; }
      try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify(portraitData)); }
      catch (e) { alert('A imagem ficou visível, mas foi grande demais para salvar localmente. Tente uma versão mais leve.'); }
    }
    (function () {
      const raw = localStorage.getItem(PORTRAIT_KEY);
      if (!raw) return;
      if (raw.charAt(0) === '{') {
        try { portraitData = JSON.parse(raw); } catch (e) { portraitData = null; }
      } else {
        portraitData = { src: raw };
      }
      if (portraitData && portraitData.src) {
        if (typeof portraitData.zoom !== 'number') portraitData.zoom = 1;
        if (typeof portraitData.panX !== 'number') portraitData.panX = 0;
        if (typeof portraitData.panY !== 'number') portraitData.panY = 0;
      } else { portraitData = null; }
    })();

    portraitEl.addEventListener('click', function () {
      if (portraitData) { openCrop(null, false); } else { fileEl.click(); }
    });
    portraitEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); portraitEl.click(); }
    });
    fileEl.addEventListener('change', function () {
      const file = fileEl.files && fileEl.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const MAX = 1100;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            const r = Math.min(MAX / w, MAX / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          // PNG com transparência: achata sobre o verde do círculo (JPEG ficaria preto)
          ctx.fillStyle = '#1e3a2f';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          openCrop({ src: canvas.toDataURL('image/jpeg', 0.9), zoom: 1, panX: 0, panY: 0 }, true);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      fileEl.value = '';
    });
    if (removeBtn) removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      portraitData = null;
      renderPortrait();
      savePortrait();
    });

    // ----- modal do editor -----
    const modal = $('cropModal'), stage = $('cropStage'), stageImg = $('cropImg'), zoomSlider = $('cropZoom');
    let crop = null;
    let natural = { w: 1, h: 1 };
    let drag = null;

    function panLimits(z) {
      const s = Math.max(STAGE_SIZE / natural.w, STAGE_SIZE / natural.h);
      const rw = natural.w * s * z, rh = natural.h * s * z;
      return {
        x: Math.max(0, (rw - STAGE_SIZE) / 2) / STAGE_SIZE,
        y: Math.max(0, (rh - STAGE_SIZE) / 2) / STAGE_SIZE
      };
    }
    function clampPan() {
      const l = panLimits(crop.zoom);
      crop.panX = Math.max(-l.x, Math.min(l.x, crop.panX));
      crop.panY = Math.max(-l.y, Math.min(l.y, crop.panY));
    }
    function renderCrop() {
      clampPan();
      applyFraming(stageImg, STAGE_SIZE, crop, natural);
      if (zoomSlider) zoomSlider.value = crop.zoom;
    }
    function openCrop(p, isNew) {
      const base = p || portraitData;
      if (!base || !base.src) return;
      if (!modal || !stage || !stageImg) {
        portraitData = { src: base.src, zoom: 1, panX: 0, panY: 0 };
        renderPortrait(); savePortrait();
        return;
      }
      crop = { src: base.src, zoom: base.zoom || 1, panX: base.panX || 0, panY: base.panY || 0 };
      if (isNew) { crop.zoom = 1; crop.panX = 0; crop.panY = 0; }
      stageImg.src = crop.src;
      const probe = new Image();
      probe.onload = function () {
        natural = { w: probe.naturalWidth, h: probe.naturalHeight };
        renderCrop();
      };
      probe.src = crop.src;
      modal.hidden = false;
    }
    function closeCrop() { modal.hidden = true; crop = null; drag = null; }

    if (modal && stage && stageImg) {
      stage.addEventListener('pointerdown', function (e) {
        if (!crop) return;
        drag = { x: e.clientX, y: e.clientY, px: crop.panX, py: crop.panY };
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', function (e) {
        if (!crop || !drag) return;
        crop.panX = drag.px + (e.clientX - drag.x) / STAGE_SIZE;
        crop.panY = drag.py + (e.clientY - drag.y) / STAGE_SIZE;
        renderCrop();
      });
      stage.addEventListener('pointerup', function () { drag = null; });
      stage.addEventListener('pointercancel', function () { drag = null; });
      stage.addEventListener('wheel', function (e) {
        if (!crop) return;
        e.preventDefault();
        crop.zoom = Math.max(1, Math.min(3, crop.zoom - e.deltaY * 0.0015));
        renderCrop();
      }, { passive: false });
    }
    if (zoomSlider) zoomSlider.addEventListener('input', function () {
      if (!crop) return;
      crop.zoom = Math.max(1, Math.min(3, parseFloat(zoomSlider.value) || 1));
      renderCrop();
    });
    on('cropSwap', 'click', function () { closeCrop(); fileEl.click(); });
    on('cropCancel', 'click', function () { closeCrop(); });
    on('cropOk', 'click', function () {
      if (!crop) { closeCrop(); return; }
      portraitData = crop;
      renderPortrait();
      savePortrait();
      closeCrop();
      activity(WHO, '🖼 ajustou o retrato');
    });

    renderPortrait();
  })();

  // ---------- Carta que segue o cursor (só PC) ----------
  // O baralho anda atrás dele pela página e vai virando outra carta de tempos em tempos.
  // É só enfeite: não mexe em estado, rolagem nem no sorteio.
  (function () {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const card = $('cursorCard'); if (!card) return;
    const face = $('cursorCardFace');
    const FACES = CARTAS.map(function (c) { return c.emoji; });
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, px = tx, py = ty, rota = 0, andou = 0;
    function virar() {
      if (!face) return;
      let f = FACES[Math.floor(Math.random() * FACES.length)];
      if (f === face.textContent) f = FACES[(FACES.indexOf(f) + 1) % FACES.length]; // evita repetir a mesma
      face.textContent = f;
      card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
    }
    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      andou += Math.abs(tx - px) + Math.abs(ty - py); px = tx; py = ty;
      card.classList.add('seen');
      if (andou > 900) { andou = 0; virar(); } // a cada ~900px de percurso, outra carta
    });
    setInterval(virar, 5200); // parado também: o baralho não fica calado
    (function loop() {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      const inclinar = Math.max(-24, Math.min(24, (tx - x) * 0.6));
      rota += (inclinar - rota) * 0.12;
      card.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) translate(16px,20px) rotate(' + rota.toFixed(1) + 'deg)';
      requestAnimationFrame(loop);
    })();
    virar();
  })();

  // ---------- Monitor de atividade (cliques/decisões) ----------
  function readActs() { try { var l = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeActs(l) { try { localStorage.setItem(ACT_KEY, JSON.stringify(l)); } catch (e) {} }
  function activity(who, act) {
    if (!act) return;
    var l = readActs();
    l.unshift({ who: who || WHO, act: String(act).slice(0, 80), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    writeActs(l.slice(0, ACT_MAX));
  }
  function describeEl(node) {
    if (!node || !node.tagName) return null;
    var act = (node.getAttribute('data-act') || '').trim(); if (act) return act;
    if (node.classList && node.classList.contains('tab-btn')) return '🗂 abriu a aba ' + (node.textContent || '').trim();
    if (node.tagName === 'A') { var at = (node.textContent || '').trim(); return at ? '🔗 ' + at : null; }
    if (node.tagName === 'BUTTON') {
      var txt = (node.textContent || '').trim();
      if (!txt || txt.indexOf('🎲') !== -1) return null; // rolagens já caem no histórico de rolagem
      return txt.length > 42 ? null : '👆 ' + txt;
    }
    return null;
  }
  document.addEventListener('click', function (e) {
    var node = e.target && e.target.closest ? e.target.closest('button, .tab-btn, a, .deck-card, .lp-card') : null;
    if (!node) return;
    if (node.classList && (node.classList.contains('deck-card') || node.classList.contains('lp-card'))) { activity(WHO, '🂠 consultou ' + (node.querySelector('.dc-nome, .cf-nome, b') ? node.querySelector('.dc-nome, .cf-nome, b').textContent : 'uma carta')); return; }
    var desc = describeEl(node); if (desc) activity(WHO, desc);
  }, true);
  document.addEventListener('focusout', function (e) {
    var node = e.target;
    if (node && node.getAttribute && node.getAttribute('contenteditable') === 'true') activity(WHO, '✎ mexeu em um texto');
  }, true);

  // Ao vivo: rolagens do grupo + mudanças que o mestre (ou esta ficha noutra aba) fizer aqui
  window.addEventListener('storage', function (e) {
    if (e.key === ROLL_KEY) { renderLog(); return; }
    if (e.key === SAVE_KEY) { refreshFromStorage(); renderInv(); }
  });

  // ---------- Boot ----------
  save(); // deixa a ficha existir no navegador: o painel do mestre e as cartas já encontram ela
  renderAttrs();
  renderHP();
  renderSAN();
  renderStatus();
  renderDeck();
  renderEnemies();
  renderInv();
  buildTargetSelect();
  resetDraw();
  renderLog();
})();

window.__FICHA_OK = true; // a ficha carregou o motor: esconde o aviso de cache velha
