/* ===== Ficha da Flora — lógica local (localStorage, sem Firebase) ===== */
(function () {
  'use strict';

  const SAVE_KEY = 'eclipse_flora_v1';
  // Histórico de rolagem é GLOBAL/compartilhado: Flora + Mestre (e futuros) usam a mesma chave.
  const ROLL_KEY = 'eclipse_roll_log';
  const ROLL_MAX = 60;

  // ---------- Estado padrão ----------
  const defaultState = {
    hp: 30,
    hpMax: 30,
    san: 100,
    sanMax: 100,
    status: [], // efeitos ativos (limite: 6)
    armas: [],  // armas atribuídas pelo mestre no futuro
    log: [],
    vicio: {
      nome: 'Licor',
      desc: 'Antes de cada apresentação, um gole. Depois de cada aplauso, outro. O licor é o único público que Flora recebe em casa — ele nunca vai embora, mesmo quando ela finge que não precisa dele. O amargor dourado desce como lembrança de Las Vegas: dias melhores servidos em copos pequenos.'
    },
    atributos: {
      forca:      { nome: 'Força',      valor: 10 },
      destreza:   { nome: 'Destreza',   valor: 18 },
      constituicao:{ nome: 'Constituição', valor: 12 },
      inteligencia:{ nome: 'Inteligência', valor: 11 },
      carisma:    { nome: 'Carisma',    valor: 16 }
    },
    combate: [
      {
        nome: 'Florete — Linha de Dança', tipo: 'Estilo principal · Destreza', atributo: 'destreza', rolar: true,
        desc: 'Esgrima de ponta misturada com passos de balé: estocadas rápidas e precisas, sempre no ritmo. Ela luta como quem dança — só que com lâmina.'
      },
      {
        nome: 'Espada Leve — Corte Decidido', tipo: 'Estilo alternativo · Força', atributo: 'forca', rolar: true,
        desc: 'Quando a elegância não basta, ela firma o passo e corta. Mais peso, menos graça — e a mão ainda assim não treme.'
      },
      {
        nome: 'Jogo de Pernas do Palco', tipo: 'Defesa e movimentação · Destreza', atributo: 'destreza', rolar: true,
        desc: 'Distância é tudo: ela lê o ritmo do adversário como lia o do parceiro de valsa — aparando, cedendo e escapando pelo fio da lâmina.'
      }
    ],
    massacre: {
      nome: 'Tesoura de Véu',
      desc: 'Sempre que Flora resolve usar a Tesoura de Véu, algo muda nela: um êxtase. Cada movimento com a tesoura na mão causa cortes profundos — dolorosos. As capacidades dela mudam por completo: ataques mais fortes, mais rápidos, e a noção de certo ou errado simplesmente apaga no meio do palco. A dança sai do controle dela; para quem a enfrenta, o resultado é uma chuva de sangue. Flora só recupera a consciência quando solta o objeto — ou quando a dança a devolve estranhamente exausta.'
    }
  };

  let state = load();

  function load() {
    let merged;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      merged = raw ? Object.assign(JSON.parse(JSON.stringify(defaultState)), JSON.parse(raw)) : JSON.parse(JSON.stringify(defaultState));
    } catch (e) { merged = JSON.parse(JSON.stringify(defaultState)); }
    // Migração: Flora agora é humana sem poderes — Status fixos em 5 e aba de Combate no lugar de Poderes.
    if (merged.atributos && merged.atributos.sabedoria) delete merged.atributos.sabedoria;
    delete merged.poderes;
    if (!Array.isArray(merged.combate) || !merged.combate.length) merged.combate = JSON.parse(JSON.stringify(defaultState.combate));
    // Migração: remove formas de combate passivas/inúteis (ex: Resistência de Bailarina).
    merged.combate = merged.combate.filter(function (f) { return f && f.rolar; });
    // Migração: sanidade (barra nova).
    if (typeof merged.san !== 'number') merged.san = defaultState.san;
    if (typeof merged.sanMax !== 'number') merged.sanMax = defaultState.sanMax;
    // Migração: o histórico virou compartilhado (chave global). Semeia uma vez e esvazia o log local.
    if (Array.isArray(merged.log) && merged.log.length && !readRolls().length) {
      writeRolls(merged.log.map(function (l) {
        return { who: 'Flora', txt: l.txt, total: l.total, detalhe: String(l.detalhe != null ? l.detalhe : ''), classe: normClasse(l.classe), hora: l.hora, t: Date.now() };
      }).slice(0, ROLL_MAX));
    }
    if (Array.isArray(merged.log)) merged.log = [];
    return merged;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* cheio: a tela segue mostrando o estado, só não persiste */ } }

  const $ = (id) => document.getElementById(id);

  // ---------- Abas ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      $('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ---------- Atributos ----------
  // Modificador nunca negativo: valores baixos ficam em +0 (sem −5 misterioso).
  function mod(v) { return Math.max(0, Math.floor((v - 10) / 2)); }
  function fmtMod(m) { return (m >= 0 ? '+' : '−') + Math.abs(m); } // mesmo − (U+2212) das marcas de carta, sem misturar com hífen

  function rollAttr(key, card) {
    const a = state.atributos[key];
    const resBox0 = card.querySelector('.attr-result');
    if (mortoBlock(resBox0)) return;
    const v = a.valor;
    const m = v + dancaBonus(); // d10 + o VALOR do status + êxtase/exaustão
    const face = 1 + Math.floor(Math.random() * 10);
    const total = face + m;
    const det = dancaDetail();

    const resBox = card.querySelector('.attr-result');
    resBox.textContent = '🎲 ' + face + ' + ' + v + det + ' = ' + total;
    card.classList.remove('rolled');
    void card.offsetWidth;
    card.classList.add('rolled');

    let classe = '';
    if (face === 10) classe = 'log-crit';
    if (face === 1)  classe = 'log-fumble';

    addRoll({
      who: 'Flora',
      txt: 'Rolou ' + a.nome + ' · d10 ' + fmtMod(m) + det,
      total: total,
      detalhe: String(face),
      classe: classe
    });
  }

  function renderAttrs() {
    const grid = $('attrsGrid');
    grid.innerHTML = '';
    const bonusSel = $('attrBonus');
    bonusSel.innerHTML = '<option value="none">nenhum atributo</option>';

    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const card = document.createElement('div');
      card.className = 'attr-card';
      card.innerHTML =
        '<div class="attr-name">' + a.nome + '</div>' +
        '<input class="attr-value" type="number" min="0" max="30" value="' + a.valor + '" />' +
        '<div class="attr-mod">' + fmtMod(mod(a.valor)) + '</div>' +
        '<div class="attr-result"></div>' +
        '<div class="attr-hint">🎲 d10 + valor do Status (+ bônus da dança)</div>';
      const input = card.querySelector('input');
      input.addEventListener('input', function () {
        const n = parseInt(input.value, 10);
        if (isNaN(n)) return; // campo vazio durante a edição: ignora, mantém o último valor
        a.valor = Math.max(0, Math.min(30, n)); // permite zerar o status
        card.querySelector('.attr-mod').textContent = fmtMod(mod(a.valor));
        fillBonusOptions();
        save();
      });
      input.addEventListener('blur', function () { input.value = a.valor; });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      card.addEventListener('click', function () { rollAttr(key, card); });
      grid.appendChild(card);
    });
    fillBonusOptions();
  }

  function fillBonusOptions() {
    const sel = $('attrBonus');
    const atual = sel.value;
    sel.innerHTML = '<option value="none">nenhum atributo</option>';
    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = a.nome + ' (' + fmtMod(mod(a.valor)) + ')';
      sel.appendChild(opt);
    });
    sel.value = atual || 'none';
  }

  // ---------- HP ----------
  function renderHP() {
    const pct = Math.max(0, Math.min(100, (state.hp / state.hpMax) * 100));
    $('hpFill').style.width = pct + '%';
    $('hpText').textContent = state.hp + ' / ' + state.hpMax;
    $('hpFill').style.background = pct <= 25
      ? 'linear-gradient(90deg,#7c1f1f,#b74a4a)'
      : 'linear-gradient(90deg,#b74a4a,#d98d8d)';
  }
  $('hpDmg').addEventListener('click', function () {
    state.hp = Math.max(0, state.hp - (parseInt($('hpInput').value, 10) || 0));
    renderHP(); save();
  });
  $('hpHeal').addEventListener('click', function () {
    if (mortoBlock($('statusMsg'))) return;
    state.hp = Math.min(state.hpMax, state.hp + (parseInt($('hpInput').value, 10) || 0));
    renderHP(); save();
  });
  $('hpMax').addEventListener('click', function () {
    if (mortoBlock($('statusMsg'))) return;
    state.hp = state.hpMax; renderHP(); save();
  });

  // ---------- Sanidade ----------
  function renderSAN() {
    const pct = Math.max(0, Math.min(100, (state.san / state.sanMax) * 100));
    $('sanFill').style.width = pct + '%';
    $('sanText').textContent = state.san + ' / ' + state.sanMax;
    // lúcida → trêmula → quebrada
    $('sanFill').style.background = pct <= 25
      ? 'linear-gradient(90deg,#3a2f55,#5b4a86)'
      : pct <= 55
        ? 'linear-gradient(90deg,#5b4a86,#8a76bd)'
        : 'linear-gradient(90deg,#7c86c4,#a9b4e6)';
  }
  $('sanDmg').addEventListener('click', function () {
    state.san = Math.max(0, state.san - (parseInt($('sanInput').value, 10) || 0));
    renderSAN(); save();
  });
  $('sanHeal').addEventListener('click', function () {
    if (mortoBlock($('statusMsg'))) return;
    state.san = Math.min(state.sanMax, state.san + (parseInt($('sanInput').value, 10) || 0));
    renderSAN(); save();
  });
  $('sanMax').addEventListener('click', function () {
    if (mortoBlock($('statusMsg'))) return;
    state.san = state.sanMax; renderSAN(); save();
  });

  // ---------- Status (chips, limite de 6, rolagem d10 + qtde de status) ----------
  const STATUS_MAX = 6;
  const EFEITO_LICOR = '🥃 Coragem de Licor';
  const EXTOSE = '🩸 Êxtase da Tesoura';
  const EXAUSTA = '💤 Exaustão da Dança';

  // Bônus/penalidade das formas de combate conforme o estado da dança
  function dancaBase() {
    if (state.status.indexOf(EXTOSE) !== -1) return 3;
    if (state.status.indexOf(EXAUSTA) !== -1) return -2;
    return 0;
  }
  // Cartas do Dante aplicadas aqui chegam como marca "emoji Nome · +N" — somam nas rolagens
  function chipValue(txt) {
    const m = /·\s*([+−])\s*(\d+)$/.exec(String(txt || ''));
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * Math.min(3, parseInt(m[2], 10) || 0);
  }
  function cardBonus() { return state.status.reduce(function (acc, s) { return acc + chipValue(s); }, 0); }
  function cardDetail() {
    let s = '';
    state.status.forEach(function (t) {
      const v = chipValue(t);
      if (v) s += (v > 0 ? ' + ' : ' − ') + Math.abs(v) + (String(t).split(' ')[0] || '🃏');
    });
    return s;
  }
  function dancaBonus() { return dancaBase() + cardBonus(); }
  // Cartas do Dante aplicadas aqui chegam como marca "emoji Nome · +N" — somam nas rolagens
  function isCardChip(txt) { return chipValue(txt) !== 0 || /·\s*[+−]\s*\d+$/.test(String(txt || '')); }
  // Morte/Incapacitada são do mestre: a Flora não pode tirar clicando no chip
  const GM_ONLY = ['☠️ MORTA', '🟡 Incapacitada', '☠️ Morto', '🟡 Incapacitado'];
  // ---------- Morta não age ----------
  // Ceifada pelo Dante (ou pelo mestre), ela não rola dado nem se levanta sozinha.
  const MARCAS_MORTE = ['☠️ MORTA', '☠️ Morto'];
  function estaMorta() {
    for (var i = 0; i < MARCAS_MORTE.length; i++) { if (state.status.indexOf(MARCAS_MORTE[i]) !== -1) return true; }
    return false;
  }
  function mortoBlock(box) {
    if (!estaMorta()) return false;
    if (box) box.textContent = '☠️ morta não age';
    const m = $('statusMsg');
    if (m) m.textContent = '☠️ Flora está MORTA — morta não rola nem se levanta. Só O Mundo 🌍, O Julgamento 🎺 ou o [Restaurar] do mestre.';
    activity('Flora', '⛔ tentou agir estando morta');
    return true;
  }
  // Detalha o efeito da dança como parcela da fórmula (pra rolagem bater com o número do Status)
  function dancaDetail() {
    let s = '';
    const b = dancaBase();
    if (b > 0) s += ' + 3🩸';
    if (b < 0) s += ' − 2💤';
    return s + cardDetail();
  }

  function renderStatus() {
    const box = $('statusChips');
    box.innerHTML = '';
    const count = $('statusCount');
    if (count) count.textContent = state.status.length + '/' + STATUS_MAX;
    if (!state.status.length) {
      box.innerHTML = '<span class="chip empty">sem efeitos — role um status ou aguarde o mestre</span>';
      return;
    }
    state.status.forEach(function (s, i) {
      const chip = document.createElement('span');
      const gm = GM_ONLY.indexOf(s) !== -1;     // morte/incapacitada: só o mestre desfaz
      const carta = !gm && isCardChip(s);
      chip.className = 'chip' + (gm ? ' gm' : (carta ? ' carta' + (chipValue(s) < 0 ? ' carta-neg' : '') : ''));
      chip.title = gm ? 'Só o mestre desfaz isso' : (carta ? 'Descartar esta marca de carta' : 'Clique para remover este status');
      chip.textContent = s;
      chip.addEventListener('click', function () {
        if (gm) {
          const m = $('statusMsg');
          if (m) m.textContent = '☠️ ' + s + ' é decisão do mestre — só o [Restaurar] dele (ou o Dante com O Mundo / O Julgamento) desfaz.';
          return;
        }
        state.status.splice(i, 1);
        renderStatus(); save();
      });
      box.appendChild(chip);
    });
  }

  function addStatus(nome) {
    if (state.status.length >= STATUS_MAX) {
      return 'Limite de ' + STATUS_MAX + ' efeitos atingido — a mente dela não comporta mais nada.';
    }
    if (state.status.indexOf(nome) !== -1) {
      return '“' + nome + '” já está ativo agora.';
    }
    state.status.push(nome);
    renderStatus(); save();
    return 'Novo efeito: “' + nome + '”.';
  }

  function addStatusManual() {
    const msg = $('statusMsg');
    const input = $('statusInput');
    const nome = (input.value || '').trim();
    if (!nome) { msg.textContent = 'Escreva o nome do efeito primeiro.'; return; }
    msg.textContent = addStatus(nome);
    input.value = '';
    input.focus();
  }
  $('statusAddBtn').addEventListener('click', addStatusManual);
  $('statusInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addStatusManual(); }
  });

  // ---------- Inventário (armas enviadas pelo mestre) ----------
  // Interpreta o texto de dano: "d8+2", "2d6", "d20", "1d10+3", ou número fixo "5".
  function parseDice(str) {
    if (str == null) return null;
    var s = String(str).toLowerCase().replace(/\s+/g, '');
    var m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (m) {
      return {
        qtde: Math.max(1, Math.min(20, parseInt(m[1], 10) || 1)),
        faces: Math.max(2, parseInt(m[2], 10) || 6),
        bonus: parseInt(m[3], 10) || 0
      };
    }
    var f = s.match(/^([+-]?\d+)$/);
    if (f) return { qtde: 0, faces: 0, bonus: parseInt(f[1], 10) || 0 }; // dano fixo
    return null;
  }

  function rollWeapon(w, li) {
    const d = parseDice(w.dano);
    const out = li.querySelector('.weapon-result');
    if (mortoBlock(out)) return;
    if (!d) { out.textContent = '⚠ o mestre precisa definir um dano (ex: d8+2).'; return; }
    const db = dancaBonus(); // respeita êxtase (+3) / exaustão (−2)
    let total, faceTxt, crit = false, fumble = false;
    if (d.qtde >= 1) {
      const r = rollDice(d.faces, d.qtde, d.bonus + db);
      total = r.total;
      faceTxt = r.resultados.join(' + ');
      if (d.qtde === 1 && d.faces === 20) { crit = r.resultados[0] === 20; fumble = r.resultados[0] === 1; }
    } else {
      total = d.bonus + db; faceTxt = 'dano fixo';
    }
    const det = dancaDetail();
    out.textContent = '🎲 ' + faceTxt + (d.bonus ? (d.bonus >= 0 ? ' + ' + d.bonus : ' − ' + -d.bonus) : '') + det + ' = ' + total + ' de dano';
    out.classList.remove('show'); void out.offsetWidth; out.classList.add('show');

    addRoll({
      who: 'Flora',
      txt: 'Dano · ' + w.nome + ' (' + (w.dano || '—') + ')' + det,
      total: total,
      detalhe: faceTxt,
      classe: crit ? 'log-crit' : (fumble ? 'log-fumble' : '')
    });
  }

  function renderInv() {
    const area = $('invArea');
    if (!area) return;
    if (!state.armas.length) return; // mantém a mensagem de vazio do HTML
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
      actions.className = 'w-actions';
      actions.appendChild(dice); actions.appendChild(btn);

      const res = document.createElement('p');
      res.className = 'weapon-result';

      li.appendChild(name); li.appendChild(actions); li.appendChild(res);
      ul.appendChild(li);
    });
    area.appendChild(ul);
  }

  // ---------- Rolagem ----------
  function rollDice(tipo, qtde, bonus) {
    const resultados = [];
    let soma = 0;
    for (let i = 0; i < qtde; i++) {
      const r = 1 + Math.floor(Math.random() * tipo);
      resultados.push(r);
      soma += r;
    }
    return { resultados: resultados, total: soma + bonus, bonus: bonus };
  }

  $('rollBtn').addEventListener('click', function () {
    if (mortoBlock($('rollMsg'))) return;
    const tipo = parseInt($('diceType').value, 10);
    const qtde = Math.max(1, Math.min(10, parseInt($('diceQty').value, 10) || 1));
    const attrKey = $('attrBonus').value;
    let bonus = (attrKey === 'none' ? 0 : mod(state.atributos[attrKey].valor)) + dancaBonus(); // + êxtase/exaustão

    const die = $('die');
    die.classList.remove('rolling', 'crit', 'fumble');
    void die.offsetWidth; // reinicia animação
    die.classList.add('rolling');

    setTimeout(function () {
      const r = rollDice(tipo, qtde, bonus);
      die.textContent = r.resultados.join('+');

      const natural = r.resultados[0];
      const det = dancaDetail();
      let msg = 'Total: ' + r.total + (bonus ? ' (' + (r.total - bonus) + ' ' + fmtMod(bonus) + (det ? ' ' + det.trim() : '') + ')' : '');
      let classe = '';
      if (tipo === 20 && qtde === 1 && bonus === 0) {
        if (natural === 20) { msg = '✦ ACERTO CRÍTICO! A plateia prende a respiração.'; classe = 'crit'; die.classList.add('crit'); }
        if (natural === 1)  { msg = '✧ Falha crítica… até as melhores dançarinas tropeçam.'; classe = 'fumble'; die.classList.add('fumble'); }
      }
      $('rollMsg').textContent = msg;

      addRoll({
        who: 'Flora',
        txt: (attrKey !== 'none' ? state.atributos[attrKey].nome + ' · ' : '') +
             'd' + tipo + (qtde > 1 ? '×' + qtde : '') + (bonus ? (bonus >= 0 ? ' + ' + bonus : ' − ' + -bonus) : ''),
        total: r.total,
        detalhe: r.resultados.join(', '),
        classe: classe
      });
    }, 550);
  });

  // ---------- Histórico compartilhado (chave global) ----------
  function readRolls() { try { var l = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeRolls(l) { try { localStorage.setItem(ROLL_KEY, JSON.stringify(l)); } catch (e) {} }
  function normClasse(c) { c = String(c || ''); if (c.indexOf('crit') !== -1) return 'crit'; if (c.indexOf('fumble') !== -1) return 'fumble'; return ''; }
  function addRoll(entry) {
    const list = readRolls();
    list.unshift({
      who: entry.who || 'Flora',
      txt: entry.txt || 'Rolagem',
      total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '',
      classe: normClasse(entry.classe),
      hora: entry.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      t: Date.now()
    });
    writeRolls(list.slice(0, ROLL_MAX));
    renderLog();
  }

  function renderLog() {
    const ul = $('rollLog');
    if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    const list = readRolls();
    if (!list.length) {
      const li0 = document.createElement('li');
      li0.className = 'log-empty';
      li0.textContent = 'Nenhuma rolagem ainda.';
      ul.appendChild(li0);
      return;
    }
    list.forEach(function (l) {
      const li = document.createElement('li');
      const main = document.createElement('span');
      if (l.classe === 'crit') main.className = 'log-crit';
      else if (l.classe === 'fumble') main.className = 'log-fumble';
      const who = document.createElement('span');
      who.className = 'log-who' + (l.who === 'Mestre' ? ' mestre' : '');
      who.textContent = l.who || 'Flora';
      const b = document.createElement('b'); b.textContent = l.txt;
      const det = document.createElement('span'); det.className = 'log-detail'; det.textContent = '[' + (l.detalhe != null ? l.detalhe : '') + ']';
      main.appendChild(who); main.appendChild(b);
      main.appendChild(document.createTextNode(' → '));
      main.appendChild(det);
      const tot = document.createElement('span'); tot.className = 'log-total'; tot.textContent = String(l.total);
      const hora = document.createElement('small'); hora.textContent = ' · ' + l.hora;
      tot.appendChild(hora);
      li.appendChild(main); li.appendChild(tot);
      ul.appendChild(li);
    });
  }

  // ---------- Formas de Combate ----------
  function renderCombat() {
    const grid = $('combatGrid');
    if (!grid) return;
    grid.innerHTML = '';
    state.combate.forEach(function (f) {
      const card = document.createElement('div');
      card.className = 'power-card';
      const attrValido = f.atributo && state.atributos[f.atributo];
      card.innerHTML =
        '<div class="power-name" contenteditable="true">' + f.nome + '</div>' +
        '<span class="power-tag">' + f.tipo + '</span>' +
        '<p class="power-desc" contenteditable="true" spellcheck="false">' + f.desc + '</p>' +
        (f.rolar && attrValido
          ? '<button class="mini-btn power-roll-btn">🎲 Atacar · d10 +' + state.atributos[f.atributo].valor + ' (' + state.atributos[f.atributo].nome + ')</button><p class="combat-result"></p>'
          : '');

      card.querySelector('.power-name').addEventListener('blur', function (e) { f.nome = e.target.textContent.trim(); save(); });
      card.querySelector('.power-desc').addEventListener('blur', function (e) { f.desc = e.target.innerHTML; save(); });

      const btn = card.querySelector('.power-roll-btn');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (mortoBlock(card.querySelector('.combat-result'))) return;
        const a = state.atributos[f.atributo];
        const v = a.valor;
        const m = v + dancaBonus(); // valor cheio do atributo + êxtase/exaustão
        const face = 1 + Math.floor(Math.random() * 10);
        const total = face + m;
        const det = dancaDetail();

        card.querySelector('.combat-result').textContent = '🎲 ' + face + ' + ' + v + det + ' = ' + total;
        const classe = face === 10 ? 'log-crit' : (face === 1 ? 'log-fumble' : '');

        addRoll({
          who: 'Flora',
          txt: 'Ataque · ' + f.nome + ' (d10 ' + fmtMod(m) + ')' + det,
          total: total,
          detalhe: String(face),
          classe: classe
        });
      });
      grid.appendChild(card);
    });
  }

  // ---------- Massacre (Tesoura de Véu) ----------
  function renderMassacre() {
    $('mscName').textContent = state.massacre.nome;
    $('mscDesc').innerHTML = state.massacre.desc;
  }
  $('mscName').addEventListener('blur', function (e) {
    state.massacre.nome = e.target.textContent.trim() || 'Tesoura de Véu';
    save();
  });
  $('mscDesc').addEventListener('blur', function (e) {
    state.massacre.desc = e.target.innerHTML;
    save();
  });

  $('mscExtase').addEventListener('click', function () {
    const msg = $('mscMsg');
    if (mortoBlock(msg)) return;
    if (state.status.indexOf(EXTOSE) !== -1) {
      msg.textContent = 'Ela já está dentro da valsa vermelha.';
      return;
    }
    if (state.status.indexOf(EXAUSTA) !== -1) {
      msg.textContent = '💤 O corpo ainda está exausto da última dança — ela não consegue entrar em êxtase de novo até descansar.';
      return;
    }
    addStatus(EXTOSE);
    msg.textContent = state.status.indexOf(EXTOSE) !== -1
      ? '🩸 O mundo apaga. Só resta a dança — e o que ela corta. (+3 em todas as rolagens)'
      : '⚠ ' + addStatus(EXTOSE);
  });

  $('mscRecuperar').addEventListener('click', function () {
    const msg = $('mscMsg');
    const idx = state.status.indexOf(EXTOSE);
    if (idx === -1) {
      msg.textContent = 'Ela não está em êxtase agora.';
      return;
    }
    state.status.splice(idx, 1);
    addStatus(EXAUSTA);
    renderStatus(); save();
    msg.textContent = '🕊 A consciência volta como aplausos distantes.' +
      (state.status.indexOf(EXAUSTA) !== -1 ? ' O corpo cobra a conta: exaustão. (−2 em todas as rolagens, sem poder dançar de novo até descansar)' : '');
  });

  $('mscDescansar').addEventListener('click', function () {
    const msg = $('mscMsg');
    const idx = state.status.indexOf(EXAUSTA);
    if (idx === -1) {
      msg.textContent = 'Ela não está exausta agora.';
      return;
    }
    state.status.splice(idx, 1);
    renderStatus(); save();
    msg.textContent = '☕ Ela respira, tremida, e o ritmo volta ao normal. A exaustão passou.';
  });

  $('mscRoll').addEventListener('click', function () {
    const a = state.atributos.destreza;
    const v = a.valor;
    const m = v + dancaBonus(); // d10 + valor cheio da Destreza + êxtase/exaustão
    const face = 1 + Math.floor(Math.random() * 10);
    const total = face + m;
    const emExtase = state.status.indexOf(EXTOSE) !== -1;
    const exausta = state.status.indexOf(EXAUSTA) !== -1;
    const det = dancaDetail();

    $('mscResult').textContent = '🎲 ' + face + ' + ' + v + det + ' = ' + total +
      (emExtase ? ' — mais um corte na chuva 🩸' : exausta ? ' — o corpo pesa, cada passo custa 💤' : ' — a tesoura espera ela desabar no ritmo');

    addRoll({
      who: 'Flora',
      txt: 'Tesoura · Chuva de Cortes (d10 ' + fmtMod(m) + ')' + det,
      total: total,
      detalhe: String(face),
      classe: face === 10 ? 'log-crit' : (face === 1 ? 'log-fumble' : '')
    });
  });

  // ---------- Imagem da arma (Tesoura de Véu) — compartilhada: Massacre + Perfil ----------
  const ARMA_IMG_KEY = SAVE_KEY + '_arma_img';
  const mscGlass = $('mscGlass'), mscImg = $('mscImg'), mscFile = $('mscFile');
  const pfImg = $('perfilArmaImg'), pfBtn = $('perfilArmaBtn'), pfFile = $('perfilArmaFile');

  function paintArma(dataUrl) {
    if (dataUrl) {
      mscImg.src = dataUrl; mscImg.hidden = false;
      mscGlass.classList.add('has-img');
      pfImg.src = dataUrl; pfImg.hidden = false;
      pfBtn.textContent = '✂️ trocar imagem da arma';
    } else {
      mscImg.hidden = true; mscImg.removeAttribute('src');
      mscGlass.classList.remove('has-img');
      pfImg.hidden = true; pfImg.removeAttribute('src');
      pfBtn.textContent = '✂️ pôr imagem da arma';
    }
  }

  function storeArma(dataUrl) {
    if (!dataUrl) {
      localStorage.removeItem(ARMA_IMG_KEY);
      paintArma(null);
      return;
    }
    paintArma(dataUrl);
    try { localStorage.setItem(ARMA_IMG_KEY, dataUrl); }
    catch (e) { alert('A imagem ficou visível, mas é grande demais para salvar localmente. Tente uma versão mais leve.'); }
  }

  function handleArmaFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Só reduz a resolução — object-fit cover cuida do resto, sem distorção
        const MAX = 640;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        storeArma(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  mscGlass.addEventListener('click', function () { mscFile.click(); });
  mscGlass.addEventListener('contextmenu', function (e) { // botão direito remove
    e.preventDefault();
    storeArma(null);
  });
  mscFile.addEventListener('change', function () {
    handleArmaFile(mscFile.files && mscFile.files[0]);
    mscFile.value = '';
  });

  pfBtn.addEventListener('click', function () { pfFile.click(); });
  pfFile.addEventListener('change', function () {
    handleArmaFile(pfFile.files && pfFile.files[0]);
    pfFile.value = '';
  });

  const storedArma = localStorage.getItem(ARMA_IMG_KEY);
  if (storedArma) paintArma(storedArma);

  // Links internos tipo "ir para aba X" (ex: nota da arma no Perfil)
  document.querySelectorAll('[data-goto]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const btn = document.querySelector('[data-tab="' + link.dataset.goto + '"]');
      if (btn) btn.click();
    });
  });

  // ---------- Retrato (upload + editor de enquadramento) ----------
  const PORTRAIT_KEY = SAVE_KEY + '_portrait';
  const portraitEl = $('portrait');
  const portraitImg = $('portraitImg');
  const portraitHint = $('portraitHint');
  const fileEl = $('portraitFile');
  const removeBtn = $('portraitRemove');

  const SHEET_SIZE = 158; // diâmetro do círculo na ficha
  const STAGE_SIZE = 280; // diâmetro do círculo no editor

  let portraitData = null; // { src, zoom, panX, panY } — pan em fração do círculo

  function portraitTransform(p, size) {
    return 'translate(' + (p.panX * size) + 'px, ' + (p.panY * size) + 'px) scale(' + p.zoom + ')';
  }

  function renderPortrait() {
    if (!portraitData || !portraitData.src) {
      portraitEl.classList.remove('has-img');
      portraitImg.removeAttribute('src');
      portraitImg.hidden = true;
      removeBtn.hidden = true;
      portraitHint.textContent = '✦ clicar para carregar imagem ✦';
      return;
    }
    portraitImg.src = portraitData.src;
    portraitImg.hidden = false;
    portraitImg.style.transform = portraitTransform(portraitData, SHEET_SIZE);
    portraitEl.classList.add('has-img');
    removeBtn.hidden = false;
    portraitHint.textContent = '✦ clicar para ajustar ✦';
  }

  function savePortrait() {
    if (!portraitData) { localStorage.removeItem(PORTRAIT_KEY); return; }
    try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify(portraitData)); }
    catch (e) {
      alert('A imagem ficou visível, mas foi grande demais para salvar localmente. Tente uma versão mais leve.');
    }
  }

  // Migração de salvamentos antigos (imagem quadrada "queimada")
  (function () {
    const raw = localStorage.getItem(PORTRAIT_KEY);
    if (!raw) return;
    if (raw.charAt(0) === '{') {
      try { portraitData = JSON.parse(raw); } catch (e) { portraitData = null; }
    } else {
      portraitData = { src: raw, zoom: 1, panX: 0, panY: 0 };
      savePortrait();
    }
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
        // Só reduz a resolução pra caber no salvamento local —
        // o enquadramento em si é decidido no editor, sem distorção.
        const MAX = 1100;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        openCrop({ src: canvas.toDataURL('image/jpeg', 0.9), zoom: 1, panX: 0, panY: 0 }, true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    fileEl.value = '';
  });

  removeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    portraitData = null;
    renderPortrait();
    savePortrait();
  });

  // ----- modal do editor -----
  const modal = $('cropModal');
  const stage = $('cropStage');
  const stageImg = $('cropImg');
  const zoomSlider = $('cropZoom');
  let crop = null;          // parâmetros em edição
  let natural = { w: 1, h: 1 };

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
    stageImg.style.transform = portraitTransform(crop, STAGE_SIZE);
    zoomSlider.value = crop.zoom;
  }
  function openCrop(p, isNew) {
    const base = p || portraitData;
    if (!base) return;
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

  // arrastar para reposicionar
  let drag = null;
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

  zoomSlider.addEventListener('input', function () {
    if (!crop) return;
    crop.zoom = Math.max(1, Math.min(3, parseFloat(zoomSlider.value) || 1));
    renderCrop();
  });

  $('cropSwap').addEventListener('click', function () {
    closeCrop();
    fileEl.click();
  });
  $('cropCancel').addEventListener('click', function () { closeCrop(); });
  $('cropOk').addEventListener('click', function () {
    if (!crop) { closeCrop(); return; }
    portraitData = crop;
    renderPortrait();
    savePortrait();
    closeCrop();
  });

  renderPortrait();

  // ---------- Vício ----------
  function renderVice() {
    $('viceName').textContent = state.vicio.nome;
    $('viceDesc').innerHTML = state.vicio.desc;
  }
  $('viceName').addEventListener('blur', function (e) {
    state.vicio.nome = e.target.textContent.trim() || 'Licor';
    save();
  });
  $('viceDesc').addEventListener('blur', function (e) {
    state.vicio.desc = e.target.innerHTML;
    save();
  });
  $('drinkBtn').addEventListener('click', function () {
    const msg = $('drinkMsg');
    if (state.status.indexOf(EFEITO_LICOR) !== -1) {
      msg.textContent = 'Ela ainda sente o calor do licor correndo nas veias.';
      return;
    }
    const resultado = addStatus(EFEITO_LICOR);
    if (state.status.indexOf(EFEITO_LICOR) !== -1) {
      msg.textContent = 'Um gole desce como aplausos — Flora ganha “Coragem de Licor”.';
    } else {
      msg.textContent = '⚠ ' + resultado;
    }
  });

  // ---------- História editável ----------
  const STORY_KEY = SAVE_KEY + '_story2';
  const storyEl = $('storyText');
  const stored = localStorage.getItem(STORY_KEY);
  if (stored) storyEl.innerHTML = stored;
  storyEl.addEventListener('blur', function () { localStorage.setItem(STORY_KEY, storyEl.innerHTML); });

  // ---------- Estrela que segue o mouse (só PC / fichas com cursor) ----------
  (function cursorStar() {
    // ativa apenas em dispositivos com mouse (hover real)
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const star = $('cursorStar');
    if (!star) return;
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    let x = tx, y = ty, rot = 0;
    document.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      rot += (tx - x) * 0.15;
      star.style.transform = 'translate(' + x + 'px, ' + y + 'px) translate(-50%, -50%) rotate(' + rot + 'deg)';
      requestAnimationFrame(loop);
    })();
  })();

  // ---------- Monitor de atividade (o mestre vê onde o jogador clica / mexe) ----------
  const ACT_KEY = 'eclipse_activity';
  const ACT_MAX = 120;
  function readActs() { try { var l = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeActs(l) { try { localStorage.setItem(ACT_KEY, JSON.stringify(l)); } catch (e) {} }
  function activity(who, act) {
    if (!act) return;
    var l = readActs();
    l.unshift({ who: who || 'Flora', act: String(act).slice(0, 80), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    writeActs(l.slice(0, ACT_MAX));
  }
  function describeEl(node) {
    if (!node || !node.tagName) return null;
    var act = (node.getAttribute('data-act') || '').trim();
    if (act) return act;
    if (node.classList && node.classList.contains('tab-btn')) return '🗂 abriu a aba ' + (node.textContent || '').trim();
    if (node.tagName === 'A') { var at = (node.textContent || '').trim(); return at ? '🔗 ' + at : null; }
    if (node.tagName === 'BUTTON') {
      var txt = (node.textContent || '').trim();
      if (!txt || txt.indexOf('🎲') !== -1) return null; // rolagens já vão para o histórico de rolagem
      return txt.length > 42 ? null : '👆 ' + txt;
    }
    return null;
  }
  document.addEventListener('click', function (e) {
    var node = e.target && e.target.closest ? e.target.closest('button, .tab-btn, a') : null;
    if (!node) return;
    var desc = describeEl(node);
    if (desc) activity('Flora', desc);
  }, true);
  document.addEventListener('focusout', function (e) {
    var node = e.target;
    if (node && node.getAttribute && node.getAttribute('contenteditable') === 'true') activity('Flora', '✎ mexeu em um texto');
  }, true);

  // ---------- Boot ----------
  renderAttrs();
  renderHP();
  renderSAN();
  renderStatus();
  renderInv();
  renderLog();
  renderCombat();
  renderVice();
  renderMassacre();

  // Rolagens do mestre (e de outras abas) aparecem aqui ao vivo.
  // Dante também escreve nesta ficha (efeitos de carta) — recarrega sem F5.
  window.addEventListener('storage', function (e) {
    if (e.key === ROLL_KEY) { renderLog(); return; }
    if (e.key === SAVE_KEY) {
      state = load();
      renderHP(); renderSAN(); renderStatus(); renderInv();
    }
  });
})();

window.__FICHA_OK = true; // a ficha carregou o motor: esconde o aviso de cache velha
