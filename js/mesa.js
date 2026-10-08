/* ===== Éclipse — js/mesa.js: 🎲 a placa de INICIATIVA e ☁ a REGRA DA MEMÓRIA =====
   07/10 — ele pediu as duas coisas, e das duas ele disse a mesma frase: "não sei como vamos por
   isso". Então aqui está a decisão, escrita antes do código para poder ser lida depois:

   1) INICIATIVA. Uma placa no canto de TODA página (ficha, salão e painel do mestre), que qualquer
      um da mesa pode rolar e que todo mundo vê igual ao mesmo tempo. A conta é a mais curta que
      existe nesta mesa: **d10 + Destreza** (o atributo do "quem age primeiro" é a Destreza em
      qualquer ficha, e é o mesmo número que já vale na Esquiva). Bicho em cena entra na mesma
      fila com o d10 + a Destreza dele, que o mestre põe no bestiário. Quem está em 🩸 massacre
      soma o +6 na hora de tirar quem joga primeiro — é "+6 EM TUDO", e iniciativa é um "tudo".
      Um clique marcado como **▶ vez de** corre a fila sem rolar dado nenhum: a ordem é sorteada
      uma vez por cena, a vez passa de mão em mão.

   2) MEMÓRIA. Ele foi claro: "quando o RPG começar todos eles vão nem sequer lembrar dessas
      coisas ... a ideia é que todos comecem sem memória alguma". As histórias que moram nas
      fichas (a criança que virou uma, o mercadinho com o bunker atrás, a terceira criança que
      ele não nomeia) são LITERATURA DE QUEM JOGA, não personagem falante. Por isso a faixa fica
      no topo de toda página, com o botão para dispensar e para reler: se alguém esquecer da
      regra no meio da sessão, a placa avisa de novo.

   Por que mais um arquivo separado: como o massacre (js/extase.js), a pergunta "quem joga agora?"
   é feita de oito páginas e a resposta tem que ser a MESMA lista em todas elas. O estado mora
   numa chave única (`eclipse_iniciativa_v1`) que o js/store.js sobe para o banco sozinho — nada
   aqui precisa saber de Firebase. O que é mania deste aparelho (placa aberta, faixa fechada)
   vai dentro da chave local do js/aliados.js, que já é declaradamente só deste navegador. */
(function (global) {
  'use strict';

  var KEY = 'eclipse_iniciativa_v1';
  var LEMBRE_KEY = 'eclipse_aliados_v1'; // local por natureza: placa aberta/fechada e faixa dispensada
  var ATIV_KEY = 'eclipse_activity';
  var ROLL_KEY = 'eclipse_roll_log';
  var doc = global.document;

  /* Reserva: se a cache estiver velha e o js/extase.js não tiver chegado, a placa ainda sabe
     quem são os seis. É a única lista de fichas repetida neste site, e é de propósito — sem ela
     a iniciativa roalaria só os bichos, que é o pior tipo de placa meio-morta. */
  var RESERVA = [
    { chave: 'eclipse_flora_v1', quem: 'Flora', arq: 'flor.html' },
    { chave: 'eclipse_coelho_v1', quem: 'Nox', arq: 'personagem2.html' },
    { chave: 'eclipse_santiago_v1', quem: 'Dante', arq: 'personagem3.html' },
    { chave: 'eclipse_ficha4_v1', quem: 'Tessalha', arq: 'ficha4.html' },
    { chave: 'eclipse_ficha5_v1', quem: 'Clara', arq: 'ficha5.html' },
    { chave: 'eclipse_ficha6_v1', quem: 'Vesper Graves', arq: 'ficha6.html' }
  ];
  function fichas() {
    var X = global.ECLIPSE_EXTASE;
    if (X && Array.isArray(X.fichas) && X.fichas.length === RESERVA.length) return X.fichas;
    return RESERVA;
  }

  function arquivo() {
    try { return String(location.pathname).split('/').pop().toLowerCase(); } catch (e) { return ''; }
  }
  var AQUI = null, PAGINA = arquivo();
  fichas().forEach(function (f) { if (f.arq === PAGINA) AQUI = f; });

  function d10() { return 1 + Math.floor(Math.random() * 10); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function limpa(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function agora() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

  function quemSou() {
    var X = global.ECLIPSE_EXTASE;
    if (AQUI && X && X.nomeNa) { try { return X.nomeNa(AQUI.chave); } catch (e) { /* segue o plano B */ } }
    if (AQUI) return AQUI.quem;
    var e = null;
    try { e = JSON.parse(localStorage.getItem('eclipse_eu_v1') || 'null'); } catch (x) { e = null; }
    var n = e && typeof e.nome === 'string' ? e.nome.trim() : '';
    if (n) return n;
    return PAGINA.indexOf('mestre') === 0 ? 'painel do mestre' : 'salão';
  }

  /* ---------- o estado compartilhado ---------- */
  function ler() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || !Array.isArray(o.ordem)) return null;
    return o;
  }
  function grava(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function bilhete(who, act) {
    var l = [];
    try { l = JSON.parse(localStorage.getItem(ATIV_KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({ who: who, act: String(act).slice(0, 80), hora: agora(), t: Date.now() });
    try { localStorage.setItem(ATIV_KEY, JSON.stringify(l.slice(0, 200))); } catch (e) {}
  }
  /* UMA linha no histórico compartilhado por iniciativa rolada (não dez): a placa é o lugar de
     ver a ordem inteira; o log serve para o mestre saber que ela foi sorteada e quem tirou o 1º. */
  function rolagem(entry) {
    var l = [];
    try { l = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({
      who: entry.who || 'a mesa', txt: entry.txt || 'Iniciativa', total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '', classe: entry.classe || '',
      hora: agora(), t: Date.now()
    });
    try { localStorage.setItem(ROLL_KEY, JSON.stringify(l.slice(0, 120))); } catch (e) {}
  }

  /* ---------- de onde vêm os números ---------- */
  function fichaDe(chave) {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { s = null; }
    return (s && typeof s === 'object') ? s : null;
  }
  /* A Destreza dele, do jeito que a ficha dela está AGORA: o valor distribuído + o +6 do
     massacre, se o objeto estiver na mão. O 💨 do Vesper e as peles do Nox moram dentro do
     motor de cada ficha e não são visíveis daqui de fora — por isso a placa diz, em miúdos,
     o que ela somou, e qualquer um pode ajustar na própria ficha se a conta não bater. */
  function destDe(chave) {
    var s = fichaDe(chave);
    var base = s && s.atributos && s.atributos.destreza ? num(s.atributos.destreza.valor) : 0;
    var X = global.ECLIPSE_EXTASE;
    var extra = 0;
    if (X && X.valor) { try { extra = X.valor(chave) || 0; } catch (e) { extra = 0; } }
    return { base: base, extra: extra, total: base + extra };
  }
  function vivoDa(chave) {
    var s = fichaDe(chave);
    if (!s) return null;
    return { hp: num(s.hp), hpMax: num(s.hpMax) };
  }

  /* ---------- as três ações da placa ---------- */
  function linhaPessoa(f) {
    var d = destDe(f.chave);
    var face = d10();
    var nome = quemDa(f);
    return {
      id: 'p:' + f.chave, quem: nome, chave: f.chave, bicho: false,
      d: face, dest: d.total, destBase: d.base, extase: d.extra, total: face + d.total,
      vivo: vivoDa(f.chave)
    };
  }
  function quemDa(f) {
    var X = global.ECLIPSE_EXTASE;
    if (X && X.nomeNa) { try { return X.nomeNa(f.chave); } catch (e) { /* usa o nome da mesa */ } }
    var s = fichaDe(f.chave);
    var n = s && (s.nome || (s.textos && s.textos.nome));
    n = String(n == null ? '' : n).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return n || f.quem;
  }
  function linhaBicho(b) {
    var face = d10();
    var dest = num(b.dest);
    return { id: 'b:' + b.id, quem: b.nome || 'Inimigo', bicho: true, d: face, dest: dest, total: face + dest };
  }
  function ordena(v) {
    /* Maior primeiro; empate no total se desfaz pelo dado maior (não pela ficha nem pelo nome),
       porque "quem tirou mais no dado joga na frente" é a única desempate que a mesa inteira
       aceita sem discussão. A última chave é só para nunca depender da sorte do objeto. */
    v.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      if (b.d !== a.d) return b.d - a.d;
      return String(a.quem).localeCompare(String(b.quem));
    });
    return v;
  }

  function rolarMesa() {
    var EI = global.EclipseInimigos;
    var v = [];
    fichas().forEach(function (f) { v.push(linhaPessoa(f)); });
    if (EI && EI.read) {
      try { (EI.read() || []).forEach(function (b) { if (num(b.hp) > 0) v.push(linhaBicho(b)); }); } catch (e) {}
    }
    ordena(v);
    var o = { ts: Date.now(), hora: agora(), por: quemSou(), ordem: v, vez: 0, bichos: !!(EI && EI.read) };
    if (!grava(o)) return null;
    bilhete(quemSou(), '🎲 rolou a INICIATIVA da mesa · 1º ' + v[0].quem + ' (' + v[0].total + ')');
    rolagem({ who: quemSou(), txt: '🎲 Iniciativa da mesa · 1º ' + v[0].quem, total: v[0].total,
      detalhe: v.map(function (x) { return x.quem + ' ' + x.total; }).join(' · ') });
    desenharTudo();
    return o;
  }
  /* "Só eu": rola o meu dado e me recoloca na fila, sem redesenhar a ordem dos outros — serve no
     meio de uma cena em que alguém entrou agora (ou acordou). */
  function rolarEu() {
    if (!AQUI) return rolarMesa(); // salão e painel do mestre não têm "eu" de ficha: rolam a mesa
    var o = ler();
    if (!o) { return rolarMesa(); }
    var meu = linhaPessoa(AQUI);
    var resto = (o.ordem || []).filter(function (x) { return x.id !== meu.id; });
    resto.push(meu);
    ordena(resto);
    var novo = { ts: Date.now(), hora: agora(), por: quemSou(), ordem: resto, vez: 0, bichos: o.bichos };
    if (!grava(novo)) return null;
    bilhete(quemSou(), '🎲 rolou a própria iniciativa (' + meu.total + ')');
    rolagem({ who: quemSou(), txt: '🎲 Minha iniciativa · d10 ' + meu.d + ' + Destreza ' + meu.dest,
      total: meu.total, detalhe: String(meu.d) });
    desenharTudo();
    return novo;
  }
  /* Passar a vez não rola dado nenhum: a ordem é da cena, a vez é do relógio dela. */
  function marcarVez(indice) {
    var o = ler();
    if (!o || !o.ordem || !o.ordem.length) return null;
    var i = Math.max(0, Math.min(o.ordem.length - 1, num(indice)));
    o.vez = i;
    if (!grava(o)) return null;
    desenharTudo();
    return o;
  }
  function proximaVez() {
    var o = ler();
    if (!o || !o.ordem || !o.ordem.length) return null;
    return marcarVez((num(o.vez) + 1) % o.ordem.length);
  }
  function apagar() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    desenharTudo();
    return true;
  }

  /* ---------- a frase que vale para a mesa inteira ---------- */
  var MEMORIA = '☁ REGRA DA MESA — ninguém lembra de nada. Quando o RPG começar, cada um acorda ' +
    'sem memória própria. As histórias que estão nas fichas (a noite chuvosa, o mercadinho com o ' +
    'bunker atrás, as duas crianças que viraram uma) são o que VOCÊ, que joga, lê para entender ' +
    'o seu personagem — na mesa ninguém fala disso, porque ninguém sabe. Quem é cada um aparece ' +
    'só no que cada um faz.';
  function avisoLigado() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(LEMBRE_KEY) || 'null'); } catch (e) { o = null; }
    return !(o && o.aviso === 0);
  }
  function lembrar(chave, valor) {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(LEMBRE_KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') o = {};
    o[chave] = valor;
    try { localStorage.setItem(LEMBRE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function lembradoDe(chave) {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(LEMBRE_KEY) || 'null'); } catch (e) { o = null; }
    return !!(o && o[chave]);
  }

  /* ---------- o desenho ---------- */
  var ESTILO = [
    '.ini-tab{position:fixed;right:18px;top:96px;z-index:64;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:var(--serif-title,Georgia,serif)}',
    '.ini-chave{cursor:pointer;border-radius:999px;padding:7px 13px;font-family:inherit;font-size:12px;letter-spacing:1px;',
    '  background:rgba(255,255,255,.94);color:#4a3f28;border:1px solid var(--gold,#c9a24b);box-shadow:0 8px 22px rgba(0,0,0,.18);transition:.2s}',
    '.ini-chave:hover{background:var(--gold-soft,#e6cf8b);transform:translateY(-2px)}',
    '.ini-caixa{width:284px;max-width:76vw;max-height:min(58vh,460px);overflow:auto;padding:11px 12px;',
    '  background:rgba(255,255,255,.96);border:1px solid var(--gold,#c9a24b);border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.22)}',
    '.ini-tab.feixada .ini-caixa{display:none}',
    '.ini-titulo{margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8b8677}',
    '.ini-conta{margin:0 0 8px;font-size:11.5px;line-height:1.45;color:#6d6857}',
    '.ini-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.ini-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.5px;padding:6px 8px;border-radius:10px;',
    '  border:1px solid rgba(0,0,0,.08);cursor:pointer;background:rgba(0,0,0,.02)}',
    '.ini-row:hover{border-color:var(--gold,#c9a24b)}',
    '.ini-row.agora{border-color:#8d2126;background:rgba(163,40,44,.12);box-shadow:inset 3px 0 0 #8d2126}',
    '.ini-pos{font-family:var(--serif-title);font-size:11px;letter-spacing:1px;color:#8a6d1f;flex:0 0 auto}',
    '.ini-nome{font-size:13px;letter-spacing:.3px}',
    '.ini-bicho{font-style:italic;color:#7a6f57}',
    '.ini-tot{margin-left:auto;font-family:var(--serif-title);font-size:13px}',
    '.ini-det{flex:1 1 100%;font-size:10.5px;color:#8b8677}',
    '.ini-botoes{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 0}',
    '.ini-aviso{margin:8px 0 0;font-size:10.5px;line-height:1.45;color:#8b8677}',
    '.ini-cair{color:#9c2b2b}',
    '.mem-faixa{position:relative;margin:0 0 14px;padding:9px 40px 9px 14px;border:1px solid var(--gold,#c9a24b);',
    '  border-radius:12px;background:linear-gradient(180deg,rgba(120,120,140,.14),rgba(0,0,0,0));font-size:12.5px;line-height:1.5}',
    '.mem-fechar{position:absolute;right:8px;top:7px;cursor:pointer;border:0;background:transparent;color:#8b8677;font-size:15px;line-height:1}',
    'html[data-theme="dark"] .ini-chave{background:rgba(38,36,44,.94);color:var(--gold-soft,#e4cf96);border-color:#57471f}',
    'html[data-theme="dark"] .ini-caixa{background:rgba(38,36,44,.96);border-color:#57471f}',
    'html[data-theme="dark"] .ini-row{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.03)}',
    'html[data-theme="dark"] .ini-nome,html[data-theme="dark"] .ini-tot{color:#ddd6c8}',
    'html[data-theme="dark"] .mem-faixa{background:linear-gradient(180deg,rgba(160,160,190,.12),rgba(0,0,0,0));color:#c9c3b4;border-color:#57471f}',
    '@media (max-width:700px){.ini-tab{top:78px;right:12px}.ini-caixa{max-height:52vh}}'
  ].join('\n');

  function estilo() {
    if (doc.getElementById('iniEstilo')) return;
    var s = el('style');
    s.id = 'iniEstilo';
    s.textContent = ESTILO;
    doc.head.appendChild(s);
  }

  function ordinal(i) { return (i + 1) + 'º'; }

  /* Uma linha da ordem: posição, nome, o total e — embaixo, miúdo — a conta que o gerou. Sem a
     conta escrita a placa seria um número mandando em gente. */
  function linha(x, i, o) {
    var li = el('li', 'ini-row' + (num(o.vez) === i ? ' agora' : ''));
    li.title = 'clique para marcar a vez dele';
    li.appendChild(el('span', 'ini-pos', ordinal(i)));
    var nome = el('span', 'ini-nome' + (x.bicho ? ' ini-bicho' : ''), (x.bicho ? '👹 ' : '') + x.quem);
    li.appendChild(nome);
    if (!x.bicho && x.vivo && x.vivo.hpMax > 0 && x.vivo.hp <= 0) li.appendChild(el('span', 'ini-cair', '🟥 caído'));
    li.appendChild(el('b', 'ini-tot', String(x.total)));
    var conta = 'd10 ' + x.d + ' + Destreza ' + x.dest;
    if (!x.bicho && x.extase) conta += ' (sendo ' + x.destBase + ' da ficha + ' + x.extase + '🩸)';
    li.appendChild(el('span', 'ini-det', conta + (num(o.vez) === i ? ' · ▶ É A VEZ DELE' : '')));
    li.addEventListener('click', function () { marcarVez(i); });
    return li;
  }

  function botoes(box, compacto) {
    var bs = el('div', 'ini-botoes');
    var b1 = el('button', 'mini-btn ok', '🎲 Rolar a mesa');
    b1.type = 'button';
    b1.title = 'd10 + Destreza para os seis e para cada bicho em cena; a ordem sobe para todo mundo';
    b1.addEventListener('click', function () { rolarMesa(); });
    bs.appendChild(b1);
    if (AQUI) {
      var b2 = el('button', 'mini-btn', '🎲 Só eu');
      b2.type = 'button';
      b2.title = 'rola o meu e me recoloca na fila sem mexer nos outros';
      b2.addEventListener('click', function () { rolarEu(); });
      bs.appendChild(b2);
    }
    var b3 = el('button', 'mini-btn', '▶ Próxima vez');
    b3.type = 'button';
    b3.title = 'passa a vez para o próximo da ordem — sem rolar dado';
    b3.addEventListener('click', function () { proximaVez(); });
    bs.appendChild(b3);
    var b4 = el('button', 'mini-btn danger', '🧹 Limpar');
    b4.type = 'button';
    b4.title = 'tira a placa do ar (acabou a cena)';
    b4.addEventListener('click', function () { apagar(); });
    bs.appendChild(b4);
    box.appendChild(bs);
    if (!compacto) return;
    var av = el('p', 'ini-aviso', '☁ A ordem é sorteada uma vez por cena. Quem está em 🩸 massacre soma +6 aqui também — a conta vem escrita embaixo de cada nome. O que NÃO entra na fila: bônus momentâneo da própria rolagem (💨 dose do impulso, 🐺 pele do Nox, 🃏 carta do Dante). A placa mede quem reacorda primeiro, não quem está mais forte naquele minuto.');
    box.appendChild(av);
    /* Fechar a faixa do topo não pode apagar a regra da memória: o mesmo lugar onde a placa vive
       deixa a frase de volta para quem fechou sem querer. */
    var mr = el('button', 'mini-btn', '☁ reler a regra da memória');
    mr.type = 'button';
    mr.title = 'mostra de novo a faixa que diz que ninguém lembra de nada no começo do RPG';
    mr.addEventListener('click', function () { relerAviso(); });
    box.appendChild(mr);
  }

  function corpoPlaca(box) {
    var o = ler();
    if (!o || !o.ordem || !o.ordem.length) {
      box.appendChild(el('p', 'ini-conta', '🎲 ninguém rolou a iniciativa ainda.'));
      botoes(box, true);
      return;
    }
    box.appendChild(el('p', 'ini-conta', 'rolada por ' + (o.por || 'a mesa') + ' às ' + (o.hora || '—') +
      (o.bichos ? ' · bichos em cena entraram na fila' : '')));
    var ul = el('ul', 'ini-lista');
    o.ordem.forEach(function (x, i) { ul.appendChild(linha(x, i, o)); });
    box.appendChild(ul);
    botoes(box, true);
  }

  /* ---------- a placa flutuante (toda página) ---------- */
  var CHAVE = null;
  function montarPlaca() {
    var tab = el('div', 'ini-tab' + (lembradoDe('placa') ? '' : ' feixada'));
    tab.id = 'iniTab';
    var caixa = el('div', 'ini-caixa');
    caixa.appendChild(el('p', 'ini-titulo', 'Ordem da mesa'));
    corpoPlaca(caixa);
    CHAVE = el('button', 'ini-chave', '🎲 —');
    CHAVE.type = 'button';
    CHAVE.title = 'quem joga primeiro (abaixo de tudo: a conta de cada um)';
    CHAVE.addEventListener('click', function () {
      var fechado = tab.classList.toggle('feixada');
      lembrar('placa', !fechado);
      if (!fechado) pintarPlaca();
    });
    tab.appendChild(caixa);
    tab.appendChild(CHAVE);
    doc.body.appendChild(tab);
  }
  function pintarPlaca() {
    if (!CHAVE) return;
    var o = ler();
    var ul = CHAVE.parentNode.querySelector('.ini-caixa');
    if (ul) { limpa(ul); ul.appendChild(el('p', 'ini-titulo', 'Ordem da mesa')); corpoPlaca(ul); }
    if (!o || !o.ordem || !o.ordem.length) { CHAVE.textContent = '🎲 ·'; CHAVE.title = 'rolar a iniciativa da mesa'; return; }
    var atual = o.ordem[num(o.vez)] || o.ordem[0];
    CHAVE.textContent = '🎲 ' + ordinal(num(o.vez)) + ' ' + (atual ? atual.quem : '—');
    CHAVE.title = '1º ' + o.ordem[0].quem + ' · ' + o.ordem.length + ' na fila · clique para abrir';
  }

  /* ---------- o bloco do painel do mestre ---------- */
  function desenharMesa(box) {
    if (!box) return;
    estilo();
    limpa(box);
    box.appendChild(el('p', 'ini-conta', 'A mesma placa que aparece no canto de cada ficha, em tamanho de palco: role aqui e os seis veem na hora.'));
    var lista = el('div', 'ini-lista');
    var o = ler();
    if (!o || !o.ordem || !o.ordem.length) {
      lista.appendChild(el('p', 'ini-conta', '🎲 ninguém rolou a iniciativa ainda — role a mesa.'));
    } else {
      lista.appendChild(el('p', 'ini-conta', 'rolada por ' + (o.por || 'a mesa') + ' às ' + (o.hora || '—')));
      o.ordem.forEach(function (x, i) { lista.appendChild(linha(x, i, o)); });
    }
    box.appendChild(lista);
    botoes(box, false);
    box.appendChild(el('p', 'ini-aviso', '☁ A ordem é sorteada uma vez por cena e a vez corre com ▶. Bicho só entra na fila se estiver de pé; a Destreza dele é o campo "desvio" do bestiário — o mesmo número que decide se ele escapa de um golpe. Dos jogadores a placa lê a Destreza ESCRITA na ficha (+6 de quem está em 🩸 massacre); dose de impulso, pele e carta na manga são da rolagem dele, não da fila.'));
  }

  /* ---------- a faixa da memória (topo de toda página) ----------
     Onde ela entra é decidido pelo layout, não por mais um id em cada HTML: se a página tem um
     invólucro de conteúdo estável (.sheet das fichas ou .mestre-wrap do painel), a faixa senta no
     começo dele; se não tem (salão), cola no topo do body. O texto é UM só para as oito páginas,
     porque regra de mesa repetida com palavras diferentes em cada tela deixa de ser regra e vira
     opinião. */
  function faixa(alvo, antes) {
    if (!doc.body || !avisoLigado()) return;
    if (doc.getElementById('memFaixa')) return;
    var p = el('div', 'mem-faixa');
    p.id = 'memFaixa';
    p.appendChild(el('span', null, MEMORIA));
    var x = el('button', 'mem-fechar', '✕');
    x.type = 'button';
    x.title = 'fechar esta faixa neste navegador (a placa 🎲 sabe reler)';
    x.addEventListener('click', function () {
      lembrar('aviso', 0);
      if (p.parentNode) p.parentNode.removeChild(p);
    });
    p.appendChild(x);
    var alvoReal = alvo || doc.body;
    alvoReal.insertBefore(p, antes === false ? null : (alvoReal.firstChild || null));
  }
  function relerAviso() {
    if (doc.getElementById('memFaixa')) return;
    lembrar('aviso', 1);
    faixa(FOLHA);
  }

  var adiado = null, FOLHA = null;
  function desenharTudo() {
    pintarPlaca();
    var m = doc.getElementById('iniciativaMesa');
    if (m) desenharMesa(m);
  }

  function iniciar() {
    if (!doc.body) return;
    estilo();
    /* Onde a faixa senta: no invólucro de conteúdo da página, quando ele existe e é estável
       (.sheet das fichas, .mestre-wrap do painel). O SALÃO fica de fora de propósito: lá o
       js/escolha.js repainta o <main id="hall"> inteiro a cada card, e uma faixa colocada dentro
       dele sumiria na primeira repintura — no salão ela vai para o topo do body. */
    FOLHA = doc.querySelector('.sheet') || doc.querySelector('.mestre-wrap') || null;
    faixa(FOLHA);
    montarPlaca();
    desenharTudo();
    /* ao vivo: outro aparelho rolou, ou o banco desceu a chave → a placa muda sozinha */
    global.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      if (e.key !== KEY && e.key !== (global.EclipseInimigos && global.EclipseInimigos.KEY) &&
          !(global.ECLIPSE_EXTASE && e.key === global.ECLIPSE_EXTASE.KEY)) return;
      if (adiado) return;
      adiado = setTimeout(function () { adiado = null; desenharTudo(); }, 300);
    });
    if (global.ECLIPSE_EXTASE && global.ECLIPSE_EXTASE.onMuda) {
      try { global.ECLIPSE_EXTASE.onMuda(desenharTudo); } catch (e) {}
    }
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) desenharTudo(); });
    global.__MESA_OK = true;
  }

  global.ECLIPSE_MESA = {
    KEY: KEY, MEMORIA: MEMORIA,
    ler: ler, rolarMesa: rolarMesa, rolarEu: rolarEu, marcarVez: marcarVez,
    proximaVez: proximaVez, apagar: apagar, desenhar: desenharTudo,
    desenharMesa: desenharMesa, mostrarAviso: relerAviso
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
