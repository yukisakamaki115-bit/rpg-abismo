/* ===== Éclipse — js/extase.js: 🩸 Massacre e 😵 Vício, das seis fichas numa página só =====
   07/10 — O mestre pediu as duas coisas na mesma frase: "vamos colocar opção agora de
   Massacre pra todos eles e vicio tbm", e definiu o massacre com as palavras dele:
   "arma ou objeto usado para deixar o personagem em êxtase, causando banho de sangue,
   tirando sua capacidade de pensar e apenas querendo matar seu alvo ou todos ao redor".

   A REGRA QUE VALE PARA TODOS, inclusive para a Flora (ele foi explícito: "isso é válido pra
   todos até mesmo pra Flora"):
     · 🩸 +6 em tudo enquanto o objeto estiver na mão;
     · o personagem sai do controle do certo e do errado — QUALQUER um pode morrer com isso,
       aliado inclusive, porque ele não distingue mais alvo de colega;
     · a cabeça não empresta o que já não tem: ele volta quando LARGA o objeto (ou quando o
       mestre o tira à força).

   Por que um arquivo separado, carregado por toda página: são QUATRO motores desenhando bônus
   (flor.js, personagem2.js, personagem3.js e ficha-comum.js das fichas 4/5/6) e o painel do
   mestre. Estado que mora dentro de cada ficha é quatro estados diferentes — a mesa ia
   descobrir que a Flora está em massacre e o painel do mestre não. Então O ESTADO é UMA chave
   compartilhada (`eclipse_extase_v1`), e cada motor só PERGUNTA a ela quanto vale agora.

   O item de cada um é exatamente o que ele ditou, com o extra que ele pediu junto:
     ✂️ Flora · Tesoura de Véu ............ já existia; agora é +6 (era +3 meu)
     🐰 Nox · Colar com pingente de sangue  consegue se transformar em HUMANO
     🔮 Dante · Carta do Louco de Sangue ... tortura, sem consciência nenhuma
     🌹 Tessalha · Tapa-olho de rosa vermelha  o Trinstan NÃO vem; sobra o ódio do Thalles
     🏮 Clara · A própria lanterna ......... as almas vão junto e a VIDA DELA DOBRA
     🌪️ Vesper Graves · a terceira foice .... +1 foice, andar nas sombras, −1 Sanidade por morte

   Os ☐ continuam ☐: o PREÇO de cada massacre (quanto custa entrar, quanto cobra na saída) ele
   só definiu para a Flora (a exaustão dela já estava escrita) e para o Vesper (−1 por morte).
   Para os outros quatro o bloco diz "☐ falta o mestre cobrar" — nada aqui inventa conta. */
(function (global) {
  'use strict';

  var KEY = 'eclipse_extase_v1';
  var ATIV_KEY = 'eclipse_activity';
  var BONUS = 6;

  /* A mesa na ordem das fichas. `chave` é a matrícula do armazenamento (nunca o nome): foi
     assim que o rename do Kael → Vesper Graves não quebrou estado nenhum, e é por isso que o
     nome bom de ler vem da própria ficha (`nomeNa`), com este aqui só de reserva. */
  var FICHAS = [
    { chave: 'eclipse_flora_v1', quem: 'Flora', arq: 'flor.html' },
    { chave: 'eclipse_coelho_v1', quem: 'Nox', arq: 'personagem2.html' },
    { chave: 'eclipse_santiago_v1', quem: 'Dante', arq: 'personagem3.html' },
    { chave: 'eclipse_ficha4_v1', quem: 'Tessalha', arq: 'ficha4.html' },
    { chave: 'eclipse_ficha5_v1', quem: 'Clara', arq: 'ficha5.html' },
    { chave: 'eclipse_ficha6_v1', quem: 'Vesper Graves', arq: 'ficha6.html' }
  ];

  var MASSACRE = {
    'eclipse_flora_v1': {
      emoji: '✂️', item: 'Tesoura de Véu',
      faz: 'Cada movimento com a tesoura na mão causa cortes profundos. As capacidades dela mudam por completo: mais forte, mais rápida — e a noção de certo ou errado apaga no meio do palco.',
      volta: 'A consciência só volta quando ela solta o objeto — e o corpo cobra: a dança a devolve estranhamente exausta (💤 −2 até descansar). Foi a única conta de massacre que o mestre já fechou.',
      exaustao: true
    },
    'eclipse_coelho_v1': {
      emoji: '🩸', item: 'Colar com pingente de sangue',
      faz: 'O pingente faz o Nox conseguir se transformar em HUMANO. Ele entra em êxtase — e a mente se perde: passa a buscar o máximo de sangue possível em qualquer situação.',
      volta: '☐ Quanto custa largar o colar? Falta o mestre cobrar. O +6 e o descontrole já valem para ele.',
      forma: 'Humano'
    },
    'eclipse_santiago_v1': {
      emoji: '🃏', item: 'Carta do Louco de Sangue',
      faz: 'Ele fica completamente maluco, querendo torturar o inimigo de todas as maneiras possíveis. Perde toda a consciência normal do certo e do errado — ele só busca a loucura.',
      volta: '☐ Quanto custa baixar a carta? Faltam as mãos do mestre nos números. O +6 e o descontrole já valem para ele.'
    },
    'eclipse_ficha4_v1': {
      emoji: '🌹', item: 'Tapa-olho de rosa vermelha',
      faz: 'O lado bobo fica oculto: só resta sangue, só resta o ódio e a destruição do Thalles. Enquanto o tapa-olho estiver posto ela NÃO CONSEGUIU CHAMAR O TRINSTAN — a Orbe fica do lado de fora com o riso dele.',
      volta: '☐ Quanto custa arrancar o tapa-olho? Faltam as mãos do mestre. O +6 e o descontrole já valem para ela.',
      tranca: 'trinstan'
    },
    'eclipse_ficha5_v1': {
      emoji: '🏮', item: 'A própria lanterna',
      faz: 'A lanterna se une a ela, e as almas vão junto. A vida dela fica o DOBRO enquanto durar. A mente se perde por completo pelas vozes que buscaram sangue: o corpo busca sangue, a alma busca prazer em sangue — tudo é sobre sangue.',
      volta: '☐ O que acontece com as almas quando ela desliga a lanterna? Faltam as mãos do mestre. O +6, a vida em dobro e o descontrole já valem para ela.',
      vidaEmDobro: true
    },
    'eclipse_ficha6_v1': {
      emoji: '🌪️', item: 'As duas foices — e a terceira',
      faz: 'Quando ele usa as duas foices no modo massacre, ganha UMA A MAIS: é a foice que o deixa maluco por sangue. Com essa terceira na mão ele também ganha se deslocar nas sombras.',
      volta: '−1 de Sanidade a cada pessoa ou criatura que morrer por ele enquanto a terceira foice estiver na mão. O +6 e o descontrole valem para ele. ☐ E a Sanidade que ele perde matando, volta como?',
      sanPorMorte: 1,
      sombras: true
    }
  };

  var VICIO = {
    'eclipse_flora_v1': { emoji: '🥃', nome: 'Licor', desc: 'Antes de cada apresentação, um gole. Depois de cada aplauso, outro. O licor é o único público que Flora recebe em casa.' },
    'eclipse_coelho_v1': { emoji: '🍬', nome: 'Doces do mundo humano', desc: 'Ele come o que o mundo de cima faz de mais bobo: bala, chocolate, tudo que é açúcar. Ninguém perguntou por quê ainda.' },
    'eclipse_santiago_v1': { emoji: '🚬', nome: 'Cigarro', desc: 'Cigarrinho atrás de cigarrinho, a fumaça é a única carta que ele joga sem cobrar de ninguém.' },
    'eclipse_ficha4_v1': null,
    'eclipse_ficha5_v1': null,
    'eclipse_ficha6_v1': { emoji: '🥃', nome: 'Uísque puro', desc: 'Gole direto, sem gelo, sem misturar. É a única coisa da vida dele que ninguém precisa aprovar.' }
  };

  /* ---------- o estado compartilhado ---------- */
  function ler() {
    var t = null;
    try { t = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { t = null; }
    return (t && typeof t === 'object' && !Array.isArray(t)) ? t : {};
  }
  function escreve(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function ativa(chave) { var e = ler()[chave]; return !!(e && e.on); }
  function valor(chave) { return ativa(chave) ? BONUS : 0; }
  /* Os extras que cada ficha tem e os outros não. O motor lê só isto e não precisa saber que
     a Clara dobra vida ou que o Vesper paga sanidade por morte. */
  function efeitos(chave) {
    var m = MASSACRE[chave] || {}, l = ativa(chave);
    return {
      on: l,
      bonus: l ? BONUS : 0,
      vidaEmDobro: !!(l && m.vidaEmDobro),
      sanPorMorte: l ? (m.sanPorMorte || 0) : 0,
      tranca: l ? (m.tranca || null) : null,
      forma: l ? (m.forma || null) : null,
      sombras: !!(l && m.sombras)
    };
  }
  function nomeNa(chave) {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { d = null; }
    var n = d && (d.nome || (d.textos && d.textos.nome));
    n = String(n == null ? '' : n).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (n) return n.slice(0, 24);
    var f = null;
    FICHAS.forEach(function (x) { if (x.chave === chave) f = x; });
    return f ? f.quem : 'alguém';
  }

  var ouvintes = [];
  function mapa(o) {
    var m = {};
    FICHAS.forEach(function (f) { m[f.chave] = !!(o[f.chave] && o[f.chave].on); });
    return m;
  }
  /* Dois fatos aconteceram aqui: o evento DOM (para o motor da página repintar o que
     depende do massacre — o badge do Status, a troca de personalidade da Tessalha) e os
     ouvintes registrados. Só disparam para a ficha que MUDOU de lado, senão um massacre da
     Clara redesenharia a ficha do Nox à toa. */
  function avisa(depois, antes) {
    FICHAS.forEach(function (f) {
      if (antes[f.chave] !== depois[f.chave]) {
        try {
          global.dispatchEvent(new CustomEvent('eclipse-extase', { detail: { chave: f.chave, on: depois[f.chave] } }));
        } catch (e) {}
      }
    });
    ouvintes.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  var ANTES = ler();
  global.addEventListener('storage', function (e) {
    if (!e || e.key !== KEY) return;
    var o = ler();
    avisa(mapa(o), mapa(ANTES));
    ANTES = o;
    /* 🏮 A vida em dobro da Clara (e o que mais a ficha dela cobrar) também vale quando OUTRA
       mão ligou o massacre — quase sempre a do mestre. Sem esta linha, ele forçando a lanterna
       veria o +6 na rolagem dela mas a barra do lampião ficaria velha na tela. */
    aplicaExtras(chaveDaPagina());
    /* O +6 é lido pelo motor a cada rolagem, mas o NÚMERO impresso no card de Status é pintado
       quando a ficha desenha. Se foi outra mão que ligou o massacre (o painel do mestre), o
       redraw não acontece sozinho — e a pessoa jogaria com um +6 que a tela dela não mostra. */
    var a = api();
    if (a && typeof a.refreshAttr === 'function') { try { a.refreshAttr(); } catch (e2) {} }
    desenharTudo();
  });

  /* Bilhete no log de cliques da mesa, com o MESMO formato que o motor usa (`who/act/hora/t`),
     para o massacre aparecer na tela do mestre sem que ninguém precise abrir a ficha. */
  function bilhete(who, act) {
    var l = null;
    try { l = JSON.parse(localStorage.getItem(ATIV_KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({ who: who, act: String(act).slice(0, 80), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    try { localStorage.setItem(ATIV_KEY, JSON.stringify(l.slice(0, 200))); } catch (e) {}
  }

  function quemAssina() {
    var e = null;
    try { e = JSON.parse(localStorage.getItem('eclipse_eu_v1') || 'null'); } catch (x) { e = null; }
    var n = e && typeof e.nome === 'string' ? e.nome.trim() : '';
    return n || 'a mesa';
  }

  /* Ligar/desligar é UMA função para as seis fichas e para o painel do mestre. O preço de
     entrada (vida, sanidade, Vínculo) é ☐ do mestre nos quatro que ele não cobrou — por isso
     nada aqui desconta número sozinho, exceto o que a própria ficha manda (a Flora e a
     exaustão dela, o Vesper e o −1 por morte, a Clara e a vida em dobro). */
  function ligar(chave, on, por) {
    var o = ler();
    var ja = !!(o[chave] && o[chave].on);
    if (ja === !!on) return ja;
    if (on) o[chave] = { on: 1, ts: Date.now(), por: String(por || quemAssina()).slice(0, 40) };
    else delete o[chave];
    if (!escreve(o)) return ja;
    var m = MASSACRE[chave] || {};
    bilhete(nomeNa(chave), on ? '🩸 entrou em MASSACRE · ' + (m.emoji || '') + ' ' + (m.item || 'objeto') : '🕊 saiu do massacre · largou o ' + (m.item || 'objeto'));
    var antes = mapa(ANTES);
    ANTES = o;
    avisa(mapa(o), antes);
    desenharTudo();
    return !!on;
  }
  function toggle(chave) { return ligar(chave, !ativa(chave)); }

  /* ---------- os dois blocos desenhados ---------- */
  var ESTILO = [
    '.ext-box{margin:18px 0 0;padding:14px 16px;border:1px solid var(--gold,#c9a24b);border-radius:14px;' +
    'background:linear-gradient(180deg,rgba(140,32,32,.07),rgba(0,0,0,0));font-family:var(--serif-body,Georgia,serif)}',
    '.ext-box.on{border-color:#a3282c;background:linear-gradient(180deg,rgba(163,40,44,.16),rgba(0,0,0,.02));box-shadow:0 10px 26px rgba(120,20,24,.18)}',
    '.ext-titulo{margin:0 0 4px;font-size:15px;letter-spacing:.6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.ext-item{font-size:13.5px;margin:0 0 8px;line-height:1.55}',
    '.ext-volta{font-size:12.5px;margin:0 0 10px;opacity:.86;line-height:1.5}',
    '.ext-acesso{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11.5px;letter-spacing:1px;' +
    'background:rgba(163,40,44,.16);color:#8d2126;border:1px solid rgba(163,40,44,.4)}',
    '.ext-livre{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11.5px;background:rgba(120,120,120,.14);color:#6b6b6b}',
    '.ext-botoes{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}',
    '.ext-msg{margin:0;font-size:12.5px;min-height:17px;color:#8d2126}',
    '.ext-regra{margin:10px 0 0;font-size:11.5px;line-height:1.5;opacity:.78}',
    '.ext-vicio{margin:14px 0 0;padding:12px 14px;border:1px dashed var(--gold,#c9a24b);border-radius:12px;font-size:13px;line-height:1.55}',
    '.ext-vicio h4{margin:0 0 6px;font-size:13.5px;letter-spacing:.6px}',
    '.ext-vicio.sem{border-style:dotted;opacity:.75}',
    '.ext-mesa{display:flex;flex-direction:column;gap:8px;margin:8px 0 0}',
    '.ext-linha{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;' +
    'border:1px solid rgba(0,0,0,.1);font-size:13px}',
    'html[data-theme="dark"] .ext-box{background:linear-gradient(180deg,rgba(163,40,44,.12),rgba(0,0,0,.04))}',
    'html[data-theme="dark"] .ext-acesso{background:rgba(163,40,44,.28);color:#f0b9bb;border-color:#7d2a2d}',
    'html[data-theme="dark"] .ext-livre{background:rgba(255,255,255,.08);color:#bdb6a6}',
    'html[data-theme="dark"] .ext-msg{color:#f0b9bb}',
    'html[data-theme="dark"] .ext-linha{border-color:rgba(255,255,255,.12)}',
    '@media (max-width:560px){.ext-box{padding:12px}}'
  ].join('\n');

  function estilo() {
    if (document.getElementById('extEstilo')) return;
    var s = document.createElement('style');
    s.id = 'extEstilo';
    s.textContent = ESTILO;
    document.head.appendChild(s);
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function limpa(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* A regra que é da mesa inteira, escrita uma vez só e repetida em cada ficha: ele pediu o
     massacre "pra todos", então o texto tem que ser o mesmo em toda tela — muda só o item. */
  function regra() {
    return '🩸 +6 em tudo enquanto o objeto estiver na mão · o personagem sai do controle do ' +
      'certo e do errado (QUALQUER um pode morrer com isso, aliado incluído) · ele volta quando ' +
      'largar o objeto. Válido para as seis fichas — inclusive a Flora, do jeito que o mestre pediu.';
  }

  /* A mensagem do clique precisa sobreviver ao redesenho: `toggle()` refaz o bloco inteiro
     (é assim que o +6 e o "em êxtase agora" aparecem na hora), e o nó onde a frase seria
     escrita deixa de existir no caminho. Então a frase mora aqui por uma virada só. */
  var PROX_MSG = {};

  function bloco(chave) {
    var m = MASSACRE[chave];
    if (!m) return null;
    var on = ativa(chave);
    var box = el('div', 'ext-box' + (on ? ' on' : ''));
    box.dataset.extase = chave;

    var t = el('p', 'ext-titulo');
    t.appendChild(el('b', null, '🩸 Massacre · ' + m.emoji + ' ' + m.item));
    t.appendChild(el('span', on ? 'ext-acesso' : 'ext-livre', on ? 'em êxtase agora' : 'a cabeça no lugar'));
    box.appendChild(t);

    box.appendChild(el('p', 'ext-item', m.faz));
    if (m.forma) box.appendChild(el('p', 'ext-item', '🐰→🧍 Em massacre ele consegue se transformar em ' + m.forma + '.'));
    if (m.tranca) box.appendChild(el('p', 'ext-item', '🚫🌀 Com o tapa-olho posto, o Trinstan não assume o corpo — a ficha recusa a troca enquanto durar o massacre.'));
    if (m.vidaEmDobro) box.appendChild(el('p', 'ext-item', '🏮 A vida dela fica o DOBRO nesta janela (a barra sobe e volta sozinha quando ela larga a lanterna).'));
    if (m.sombras) box.appendChild(el('p', 'ext-item', '🌑 Ele ganha a terceira foice e pode se deslocar nas sombras com ela.'));
    box.appendChild(el('p', 'ext-volta', m.volta));

    var bs = el('div', 'ext-botoes');
    var btn = el('button', 'btn-major' + (on ? ' danger' : ''), on ? '🕊 largar o ' + m.item.toLowerCase() : '🩸 usar ' + m.item);
    btn.type = 'button';
    btn.addEventListener('click', function () {
      var vai = !on;
      PROX_MSG[chave] = vai
        ? '🩸 ' + nomeNa(chave) + ' entrou em massacre: +6 em tudo e nenhuma noção do que é certo. Quem está perto precisa se proteger — inclusive de quem ele ama.'
        : '🕊 ' + nomeNa(chave) + ' largou o objeto. O +6 vai embora e a conta da volta, se houver, é do mestre.';
      toggle(chave);
      aplicaExtras(chave);            // vida em dobro / o que a ficha dela cobra
      var a = api();
      if (a) { try { a.refreshAttr(); } catch (e) {} }  // o badge do Status passa a mostrar o +6
    });
    bs.appendChild(btn);
    box.appendChild(bs);
    var msg = el('p', 'ext-msg', PROX_MSG[chave] || '');
    if (PROX_MSG[chave]) delete PROX_MSG[chave];
    box.appendChild(msg);
    box.appendChild(el('p', 'ext-regra', regra()));
    return box;
  }

  function blocoVicio(chave) {
    var v = VICIO[chave];
    if (!v) {
      var sem = el('div', 'ext-vicio sem');
      sem.appendChild(el('h4', null, '😵 Vício — ela não tem'));
      sem.appendChild(el('p', null, chave === 'eclipse_ficha5_v1'
        ? 'O mestre fechou: a Clara é apenas uma criança, então não tem vício nenhum. Isto é decisão de mesa, não lacuna de texto.'
        : 'O mestre fechou: a Tessalha não tem vício — é a única dos seis sem um. O que ela tem são as duas crianças dentro dela.'));
      return sem;
    }
    var b = el('div', 'ext-vicio');
    b.appendChild(el('h4', null, '😵 Vício · ' + v.emoji + ' ' + v.nome));
    b.appendChild(el('p', null, v.desc));
    b.appendChild(el('p', null, '☐ O vício ainda não cobra número nenhum: é papel, é personagem. Se o mestre quiser que ele doer (−1 de Sanidade sem a dose, ou o que for), é uma linha e ela entra aqui.'));
    return b;
  }

  /* ---------- os extras que mexem na ficha de quem os tem ----------
     A vida em dobro da Clara e o −1 de Sanidade do Vesper são as duas únicas coisas do
     massacre que mudam NÚMERO da própria ficha. Eles moram aqui, e não dentro de um motor,
     porque o motor é compartilhado por três fichas e só uma delas dobra vida. */
  var API = null;
  function api() {
    if (global.FICHA_API && global.FICHA_API.CONF) API = global.FICHA_API;
    return API;
  }
  function chaveDaPagina() {
    var a = api();
    if (a && a.CONF && a.CONF.chave) return a.CONF.chave;
    var arq = '';
    try { arq = String(location.pathname).split('/').pop().toLowerCase(); } catch (e) { arq = ''; }
    var f = null;
    FICHAS.forEach(function (x) { if (x.arq === arq) f = x; });
    return f ? f.chave : '';
  }
  /* Vida em dobro, reversível e à prova de F5: enquanto o massacre estiver ligado o motor
     guarda o teto de verdade em `state.hpMaxBase` e mostra o dobro. Ao desligar, a vida atual
     é reconvertida na mesma proporção (35/40 volta a ser 18/20, não 35/20). Roda em todo
     desenho e em toda entrada na página, então tanto faz quem ligou (a própria ficha, o
     mestre, ou a ficha dela aberta noutra máquina). */
  function aplicaExtras(chave) {
    var a = api();
    if (!a || typeof a.state !== 'function') return false;
    var s = a.state();
    if (!s || typeof s !== 'object') return false;
    var ef = efeitos(chave);
    var m = MASSACRE[chave] || {};
    var mudou = false;
    if (m.vidaEmDobro) {
      if (ef.vidaEmDobro && !s.hpMaxBase) {
        s.hpMaxBase = s.hpMax;
        s.hpMax = s.hpMax * 2;
        s.hp = Math.min(s.hpMax, s.hp * 2 + 1); // +1 de presente: quem abre a lanterna de verdade sente a alma entrando
        mudou = true;
      } else if (!ef.vidaEmDobro && s.hpMaxBase) {
        var base = s.hpMaxBase;
        s.hp = Math.max(0, Math.min(base, Math.round((s.hp * base) / (s.hpMax || base))));
        s.hpMax = base;
        delete s.hpMaxBase;
        mudou = true;
      }
    }
    if (mudou) { try { a.save(); } catch (e) {} try { a.redraw(); } catch (e2) {} }
    return mudou;
  }
  /* Chamado pelo bestiário quando um dano derruba um bicho: é aqui que o −1 por morte do
     Vesper Graves cobra a cabeça dele. Só a ficha do dono do golpe faz a conta, e ela faz
     porque o golpe saiu dela. */
  function porMorte(chaveAtacante) {
    var a = api();
    if (!a || typeof a.state !== 'function') return 0;
    var m = MASSACRE[chaveAtacante] || {};
    if (!ativa(chaveAtacante) || !m.sanPorMorte) return 0;
    var s = a.state();
    var antes = Number(s.san) || 0;
    var depois = Math.max(0, antes - m.sanPorMorte);
    if (depois === antes) return 0;
    if (typeof a.vital === 'function') a.vital('san', -m.sanPorMorte);
    else { s.san = depois; try { a.save(); } catch (e) {} }
    return m.sanPorMorte;
  }

  /* ---------- onde cada página mostra ---------- */
  function desenharTudo() {
    var box = document.getElementById('extaseArea');
    if (box) {
      var chave = chaveDaPagina();
      limpa(box);
      var b = bloco(chave);
      if (b) box.appendChild(b);
      var v = blocoVicio(chave);
      if (v) box.appendChild(v);
      aplicaExtras(chave);
    }
    var mesa = document.getElementById('extaseMesa');
    if (mesa) desenharMesa(mesa);
  }

  /* A tela do mestre: as seis linhas com o estado de cada um, e ele pode LIGAR o massacre de
     qualquer pessoa (é o mestre quem arranca o objeto da mão de alguém na mesa). */
  function desenharMesa(box) {
    estilo();
    limpa(box);
    var lista = el('div', 'ext-mesa');
    FICHAS.forEach(function (f) {
      var on = ativa(f.chave);
      var m = MASSACRE[f.chave] || {};
      var li = el('div', 'ext-linha');
      var ponto = el('span', 'ali-ponto' + (on ? ' on' : ''), null);
      li.appendChild(ponto);
      li.appendChild(el('b', null, (m.emoji || '🩸') + ' ' + nomeNa(f.chave)));
      li.appendChild(el('span', null, on ? m.item + ' na mão · +6 em tudo' : 'tranquilo'));
      var btn = el('button', 'mini-btn', on ? '🕊 largar' : '🩸 forçar');
      btn.type = 'button';
      btn.title = on ? 'tira o objeto da mão dela (é o mestre quem devolve a consciência)' : 'põe o objeto na mão dela';
      btn.addEventListener('click', function () {
        PROX_MSG[f.chave] = '';
        ligar(f.chave, !on, quemAssina());
        aplicaExtras(chaveDaPagina());
        desenharTudo();
      });
      li.appendChild(btn);
      lista.appendChild(li);
    });
    box.appendChild(lista);
    box.appendChild(el('p', 'ext-regra', regra()));
  }

  /* ---------- ligações de fora ---------- */
  function onMuda(fn) { if (typeof fn === 'function') ouvintes.push(fn); }

  function iniciar() {
    estilo();
    var chave = chaveDaPagina();
    /* O +6 entra na conta das fichas 4/5/6 pelo gancho do motor, com teto 6 — o motor continua
       sem saber o que é massacre, é só um número a mais na fórmula dele. Nos três motores
       antigos (Flora, Nox, Dante) a chamada é feita dentro do próprio arquivo, no ponto onde
       eles já somavam os próprios bônus. */
    var a = api();
    if (a && chave && MASSACRE[chave] && typeof a.hook === 'function') {
      a.hook('🩸', function () { return valor(chave); }, BONUS);
    }
    if (a && typeof a.onRedraw === 'function') a.onRedraw(function () { desenharTudo(); });
    /* Entrada na página com o objeto já na mão (F5, ou o mestre ligou isso noutro aparelho antes
       de ela abrir): os extras são conferidos ANTES do primeiro desenho, senão a Clara acordaria
       com a vida normal mesmo de lanterna acesa. */
    if (chave) aplicaExtras(chave);
    desenharTudo();
    /* Este arquivo é o ÚLTIMO da fila em todas as páginas, então os três motores antigos já
       desenharam a ficha deles sem saber que existia um massacre. Avisa que a mesa chegou: cada
       um re-pinta o que depende do +6 (badge do Status, formas do Nox, chip da Flora). Sem isto,
       abrir a página com o colar na mão mostraria o +6 só na próxima rolagem. */
    if (a && chave && ativa(chave) && typeof a.refreshAttr === 'function') { try { a.refreshAttr(); } catch (e) {} }
    try { global.dispatchEvent(new CustomEvent('eclipse-extase-ready', { detail: { chave: chave } })); } catch (e) {}
    global.__EXTASE_OK = true;
  }

  global.ECLIPSE_EXTASE = {
    KEY: KEY, BONUS: BONUS, fichas: FICHAS, itens: MASSACRE, vicios: VICIO,
    ativa: ativa, valor: valor, efeitos: efeitos, ligar: ligar, toggle: toggle,
    nomeNa: nomeNa, regra: regra, porMorte: porMorte, aplicaExtras: aplicaExtras,
    chaveDaPagina: chaveDaPagina, onMuda: onMuda, desenhar: desenharTudo,
    bloco: bloco, blocoVicio: blocoVicio, desenharMesa: desenharMesa
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
