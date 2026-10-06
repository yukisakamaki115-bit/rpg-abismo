/* ===== Painel do Mestre — leitura e edição das 5 fichas (localStorage local) =====
   As três primeiras (Flora, Nox, Dante) têm cada uma seu leitor/renderizador próprio porque
   cada uma tem estado extra (mundos do Nox, baralho do Dante). As fichas canônicas — as que
   só usam vida, sanidade, atributos, efeitos e armas — entram pela FICHAS abaixo: uma linha de
   config e o painel ganha card, radicais, envio de arma, inventário e feed. */
(function () {
  'use strict';

  // Chaves (precisam bater com flor.js)
  var FLORA_KEY = 'eclipse_flora_v1';
  var PORTRAIT_KEY = 'eclipse_flora_v1_portrait';
  var CAT_KEY = 'eclipse_armas_catalogo';
  var STATUS_MAX = 6;
  var EFF_MORTA = '☠️ MORTA';
  var EFF_INCAP = '🟡 Incapacitada';

  var ATTR_LABELS = {
    forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição',
    inteligencia: 'Inteligência', carisma: 'Carisma'
  };
  var ATTR_DEFAULT = { forca: 10, destreza: 18, constituicao: 12, inteligencia: 11, carisma: 16 };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Estado da Flora (lê sem destruir os campos que o painel não mexe) ----------
  function readFlora() {
    var s = null;
    try {
      var raw = localStorage.getItem(FLORA_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (typeof s.hp !== 'number') s.hp = 30;
    if (typeof s.hpMax !== 'number') s.hpMax = 30;
    if (typeof s.san !== 'number') s.san = 100;
    if (typeof s.sanMax !== 'number') s.sanMax = 100;
    if (!Array.isArray(s.status)) s.status = [];
    if (!Array.isArray(s.armas)) s.armas = [];
    if (!s.atributos || typeof s.atributos !== 'object') s.atributos = {};
    Object.keys(ATTR_LABELS).forEach(function (k) {
      if (!s.atributos[k] || typeof s.atributos[k].valor !== 'number') {
        s.atributos[k] = { nome: ATTR_LABELS[k], valor: ATTR_DEFAULT[k] };
      }
    });
    return s;
  }
  function writeFlora(s) {
    try { localStorage.setItem(FLORA_KEY, JSON.stringify(s)); }
    catch (e) { alert('Não consegui salvar (armazenamento cheio?).'); }
  }
  function clamp(v, lo, hi) { v = Math.round(v); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  var flora = readFlora();

  // ---------- Efeitos da Flora (as regras valem pras 3 fichas: statusAdd / statusRemove) ----------
  function hasEffect(nome) { return flora.status.indexOf(nome) !== -1; }
  function addEffect(nome) { statusAdd(flora, nome); }
  function removeEffect(nome) { statusRemove(flora, nome); }

  // ---------- Ações radicais ----------
  function incapacitar() {
    removeEffect(EFF_MORTA);
    addEffect(EFF_INCAP);
    save();
  }
  function matar() {
    if (!confirm('Tem certeza? Isso derruba a Flora de uma vez (vida e sanidade a 0).')) return;
    removeEffect(EFF_INCAP);
    flora.hp = 0; flora.san = 0;
    if (!hasEffect(EFF_MORTA)) flora.status.unshift(EFF_MORTA);
    save();
  }
  function restaurar() {
    removeEffect(EFF_MORTA);
    removeEffect(EFF_INCAP);
    flora.hp = flora.hpMax; flora.san = flora.sanMax;
    save();
  }

  // ---------- Armas: catálogo do mestre ----------
  function readCat() {
    try {
      var c = JSON.parse(localStorage.getItem(CAT_KEY) || '[]');
      return Array.isArray(c) ? c : [];
    } catch (e) { return []; }
  }
  function writeCat(c) { try { localStorage.setItem(CAT_KEY, JSON.stringify(c)); } catch (e) {} }
  var catalogo = readCat();

  function addCatalog() {
    var nome = $('wNome').value.trim();
    var dano = $('wDano').value.trim() || '—';
    if (!nome) { alert('Dê um nome à arma.'); return; }
    catalogo.push({ id: Date.now(), nome: nome, dano: dano });
    writeCat(catalogo);
    $('wNome').value = ''; $('wDano').value = '';
    $('wNome').focus();
    render();
  }
  function delCatalog(id) {
    catalogo = catalogo.filter(function (w) { return w.id !== id; });
    writeCat(catalogo);
    render();
  }
  function sendCatalog(id, alvo) {
    var w = catalogo.find(function (x) { return x.id === id; });
    if (!w) return;
    var a = alvoInventario(alvo);
    if (!a) return;
    var armas = a.get();
    if (armas.some(function (x) { return x.nome === w.nome; })) { alert('“' + w.nome + '” já está no inventário ' + a.art + ' ' + a.nome + '.'); return; }
    armas.push({ nome: w.nome, dano: w.dano });
    a.set(armas);
  }
  function removeRecv(nome, alvo) {
    var a = alvoInventario(alvo);
    if (!a) return;
    a.set(a.get().filter(function (x) { return x.nome !== nome; }));
  }
  // Onde mora o inventário de cada ficha. As 3 primeiras têm estado solto no arquivo; as
  // canônicas vivem em FICHAS. E é lido por chamada de propósito: depois de um 🔄 Sincronizar
  // o objeto trocou de identidade, e uma referência guardada uma vez escreveria em coisa morta.
  function alvoInventario(alvo) {
    if (alvo === 'nox') return { nome: 'Nox', art: 'do', get: function () { return coelho.armas; }, set: function (l) { coelho.armas = l; saveCoelho(); } };
    if (alvo === 'santiago') return { nome: 'Dante', art: 'do', get: function () { return santiago.armas; }, set: function (l) { santiago.armas = l; saveSantiago(); } };
    if (alvo === 'flora') return { nome: 'Flora', art: 'da', get: function () { return flora.armas; }, set: function (l) { flora.armas = l; save(); } };
    var f = FICHA_POR_ID[alvo];
    if (f) return { nome: fichaNome(f), art: 'da', get: function () { return f.s.armas; }, set: function (l) { f.s.armas = l; f.save(); } };
    return null;
  }

  function save() { writeFlora(flora); render(); renderFeeds(); }

  // ---------- Nox (ficha 2 · mesma edição da Flora) ----------
  var COELHO_KEY = 'eclipse_coelho_v1';
  var COELHO_PORTRAIT_KEY = COELHO_KEY + '_portrait';
  var EFF_DESFIA = '🧵 Desfiando';
  var NOX_EFF_MORTO = '☠️ Morto';
  var NOX_EFF_INCAP = '🟡 Incapacitado';
  var NOX_ATTR_DEFAULT = {
    forca: { nome: 'Força', valor: 8 }, destreza: { nome: 'Destreza', valor: 16 },
    constituicao: { nome: 'Constituição', valor: 11 }, inteligencia: { nome: 'Inteligência', valor: 15 },
    carisma: { nome: 'Carisma', valor: 13 }
  };
  function readCoelho() {
    var s = null;
    try {
      var raw = localStorage.getItem(COELHO_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (typeof s.hp !== 'number') s.hp = 24;
    if (typeof s.hpMax !== 'number') s.hpMax = 24;
    if (typeof s.san !== 'number') s.san = 100;
    if (typeof s.sanMax !== 'number') s.sanMax = 100;
    if (s.mundo !== 'real' && s.mundo !== 'outro') s.mundo = 'real';
    if (s.forma !== 'coelho' && s.forma !== 'lobo') s.forma = 'coelho';
    if (!Array.isArray(s.status)) s.status = [];
    if (!Array.isArray(s.armas)) s.armas = [];
    if (!s.atributos || typeof s.atributos !== 'object') s.atributos = {};
    Object.keys(NOX_ATTR_DEFAULT).forEach(function (k) {
      if (!s.atributos[k] || typeof s.atributos[k].valor !== 'number') s.atributos[k] = NOX_ATTR_DEFAULT[k];
      s.atributos[k].nome = ATTR_LABELS[k]; // mesmo nome nas 3 fichas (o valor é que muda)
    });
    return s;
  }
  var coelho = readCoelho();

  function writeCoelho(s) {
    try { localStorage.setItem(COELHO_KEY, JSON.stringify(s)); }
    catch (e) { alert('Não consegui salvar (armazenamento cheio?).'); }
  }
  function noxHas(nome) { return coelho.status.indexOf(nome) !== -1; }
  function noxAdd(nome) { statusAdd(coelho, nome); }
  function noxRemove(nome) { statusRemove(coelho, nome); }
  function saveCoelho() { writeCoelho(coelho); renderCoelho(); renderFeeds(); }

  // Ações radicais do Nox (espelham as da Flora, com os efeitos dele)
  function noxIncapacitar() {
    noxRemove(NOX_EFF_MORTO);
    noxAdd(NOX_EFF_INCAP);
    saveCoelho();
  }
  function noxMatar() {
    if (!confirm('Tem certeza? Isso derruba o Nox de uma vez (enchimento e linha a 0).')) return;
    noxRemove(NOX_EFF_INCAP);
    coelho.hp = 0; coelho.san = 0;
    if (!noxHas(NOX_EFF_MORTO)) coelho.status.unshift(NOX_EFF_MORTO);
    saveCoelho();
  }
  function noxRestaurar() {
    noxRemove(NOX_EFF_MORTO);
    noxRemove(NOX_EFF_INCAP);
    noxRemove(EFF_DESFIA); // restaurar = costurar tudo de volta
    coelho.hp = coelho.hpMax; coelho.san = coelho.sanMax;
    saveCoelho();
  }

  function renderCoelho() {
    // retrato
    var port = $('coelhoPortrait'); if (!port) return;
    clear(port);
    var psrc = null;
    try { var p = JSON.parse(localStorage.getItem(COELHO_PORTRAIT_KEY)); if (p && p.src) psrc = p.src; } catch (e) {}
    if (psrc) { var img = el('img'); img.src = psrc; img.alt = 'Nox'; port.appendChild(img); }
    else { port.textContent = '🦌'; }

    // badge: morto / caído / incapacitado / desfiando / outro mundo / vivo
    var badge = $('coelhoBadge');
    badge.className = 'badge';
    var desfia = coelho.status.indexOf(EFF_DESFIA) !== -1;
    if (noxHas(NOX_EFF_MORTO)) { badge.classList.add('dead'); badge.textContent = '☠️ Morto'; }
    else if (coelho.hp <= 0) { badge.classList.add('dead'); badge.textContent = 'Caído · 0 de enchimento'; }
    else if (noxHas(NOX_EFF_INCAP)) { badge.classList.add('incap'); badge.textContent = '🟡 Incapacitado'; }
    else if (desfia) { badge.classList.add('incap'); badge.textContent = '🧵 Desfiando'; }
    else if (coelho.mundo === 'outro') { badge.classList.add('outro'); badge.textContent = '🖤 Forma Verdadeira'; }
    else { badge.classList.add('alive'); badge.textContent = coelho.forma === 'lobo' ? 'Vivo · 🐺 pele de lobo' : 'Vivo · 🐇 pele de coelho'; }

    // barras
    var hpPct = clamp((coelho.hp / coelho.hpMax) * 100, 0, 100);
    $('coelhoHpFill').style.width = hpPct + '%';
    $('coelhoHpText').textContent = coelho.hp + ' / ' + coelho.hpMax;
    var sanPct = clamp((coelho.san / coelho.sanMax) * 100, 0, 100);
    $('coelhoSanFill').style.width = sanPct + '%';
    $('coelhoSanText').textContent = coelho.san + ' / ' + coelho.sanMax;

    // status (atributos) — editável aqui, igual na Flora
    renderAttrs('coelho');

    // mundo + forma atual
    // (o card inteiro pega o tom âmbar do crepúsculo enquanto ele estiver lá — assim você vê de longe)
    var card = $('coelhoCard'); if (card) card.classList.toggle('in-outro', coelho.mundo === 'outro');
    var world = $('coelhoWorld'); clear(world);
    var wc;
    if (coelho.mundo === 'outro') { wc = el('span', 'chip ro outro'); wc.textContent = '🌀 Outro Mundo · 🖤 Forma Verdadeira (+3 em tudo)'; }
    else if (coelho.forma === 'lobo') { wc = el('span', 'chip ro'); wc.textContent = '🌫️ Mundo Real · 🐺 pele de lobo (Força +2)'; }
    else { wc = el('span', 'chip ro'); wc.textContent = '🌫️ Mundo Real · 🐇 pele de coelho (Destreza +2)'; }
    // círculos de espaço abertos agora (a conta é da ficha: aqui o mestre só lê o resumo)
    if (coelho.circResumo) wc.textContent += '  ·  ' + coelho.circResumo;
    world.appendChild(wc);

    // efeitos ativos — dá pra mandar e tirar daqui, como na Flora
    renderEffectChips('coelho', chipClassNox);

    // inventário (armas enviadas) — editar aqui, receber na ficha
    var recv = $('coelhoRecv');
    if (recv) {
      clear(recv);
      if (!coelho.armas.length) recv.appendChild(el('span', 'empty-note', 'nenhuma arma enviada ainda'));
      coelho.armas.forEach(function (a) {
        var row = el('div', 'recv-item');
        row.appendChild(el('span', null, '⚔ ' + a.nome));
        var right = el('span');
        right.style.display = 'inline-flex'; right.style.gap = '10px'; right.style.alignItems = 'center';
        right.appendChild(el('span', 'w-dice', a.dano || ''));
        var rm = el('button', 'mini-btn danger', '✕');
        rm.title = 'Retirar do inventário';
        rm.addEventListener('click', function () { removeRecv(a.nome, 'nox'); });
        right.appendChild(rm);
        row.appendChild(right);
        recv.appendChild(row);
      });
    }
  }

  // ---------- Dante (ficha 3 · humano cartomante · espelho + radicais + envio de armas) ----------
  var SANTIAGO_KEY = 'eclipse_santiago_v1';
  var SANTIAGO_PORTRAIT_KEY = SANTIAGO_KEY + '_portrait';
  var STG_EFF_MORTO = '☠️ Morto';
  var STG_EFF_INCAP = '🟡 Incapacitado';
  var STG_ATTR_DEFAULT = {
    forca: { nome: 'Força', valor: 9 }, destreza: { nome: 'Destreza', valor: 12 },
    constituicao: { nome: 'Constituição', valor: 11 }, inteligencia: { nome: 'Inteligência', valor: 17 },
    carisma: { nome: 'Carisma', valor: 14 }
  };
  function readSantiago() {
    var s = null;
    try {
      var raw = localStorage.getItem(SANTIAGO_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (typeof s.hp !== 'number') s.hp = 22;
    if (typeof s.hpMax !== 'number') s.hpMax = 22;
    if (typeof s.san !== 'number') s.san = 100;
    if (typeof s.sanMax !== 'number') s.sanMax = 100;
    if (!Array.isArray(s.status)) s.status = [];
    if (!Array.isArray(s.armas)) s.armas = [];
    if (!s.atributos || typeof s.atributos !== 'object') s.atributos = {};
    Object.keys(STG_ATTR_DEFAULT).forEach(function (k) {
      if (!s.atributos[k] || typeof s.atributos[k].valor !== 'number') s.atributos[k] = STG_ATTR_DEFAULT[k];
      s.atributos[k].nome = ATTR_LABELS[k]; // mesmo nome nas 3 fichas (o valor é que muda)
    });
    return s;
  }
  var santiago = readSantiago();

  function writeSantiago(s) {
    try { localStorage.setItem(SANTIAGO_KEY, JSON.stringify(s)); }
    catch (e) { alert('Não consegui salvar (armazenamento cheio?).'); }
  }
  function stgHas(nome) { return santiago.status.indexOf(nome) !== -1; }
  function stgAdd(nome) { statusAdd(santiago, nome); }
  function stgRemove(nome) { statusRemove(santiago, nome); }
  function saveSantiago() { writeSantiago(santiago); renderSantiago(); renderFeeds(); }

  // Ações radicais do Dante (mesma cartada do Nox, com os efeitos dele)
  function santiagoIncapacitar() {
    stgRemove(STG_EFF_MORTO);
    stgAdd(STG_EFF_INCAP);
    saveSantiago();
  }
  function santiagoMatar() {
    if (!confirm('Tem certeza? Isso derruba o Dante de uma vez (fôlego e vontade a 0).')) return;
    stgRemove(STG_EFF_INCAP);
    santiago.hp = 0; santiago.san = 0;
    if (!stgHas(STG_EFF_MORTO)) santiago.status.unshift(STG_EFF_MORTO);
    saveSantiago();
  }
  function santiagoRestaurar() {
    stgRemove(STG_EFF_MORTO);
    stgRemove(STG_EFF_INCAP);
    santiago.hp = santiago.hpMax; santiago.san = santiago.sanMax;
    saveSantiago();
  }

  function renderSantiago() {
    // retrato
    var port = $('santiagoPortrait'); if (!port) return;
    clear(port);
    var psrc = null;
    try { var p = JSON.parse(localStorage.getItem(SANTIAGO_PORTRAIT_KEY)); if (p && p.src) psrc = p.src; } catch (e) {}
    if (psrc) { var img = el('img'); img.src = psrc; img.alt = 'Dante'; port.appendChild(img); }
    else { port.textContent = '🔮'; }

    // badge: morto / caído / incapacitado / vivo
    var badge = $('santiagoBadge');
    badge.className = 'badge';
    if (stgHas(STG_EFF_MORTO)) { badge.classList.add('dead'); badge.textContent = '☠️ Morto'; }
    else if (santiago.hp <= 0) { badge.classList.add('dead'); badge.textContent = 'Caído · 0 de fôlego'; }
    else if (stgHas(STG_EFF_INCAP)) { badge.classList.add('incap'); badge.textContent = '🟡 Incapacitado'; }
    else { badge.classList.add('alive'); badge.textContent = 'Vivo · 🂠 baralho na mão'; }

    // barras
    var hpPct = clamp((santiago.hp / santiago.hpMax) * 100, 0, 100);
    $('santiagoHpFill').style.width = hpPct + '%';
    $('santiagoHpText').textContent = santiago.hp + ' / ' + santiago.hpMax;
    var sanPct = clamp((santiago.san / santiago.sanMax) * 100, 0, 100);
    $('santiagoSanFill').style.width = sanPct + '%';
    $('santiagoSanText').textContent = santiago.san + ' / ' + santiago.sanMax;

    // status (atributos) — editável aqui, igual na Flora
    renderAttrs('santiago');

    // efeitos ativos — marcas de carta entram aqui quando ele aplica nele mesmo
    renderEffectChips('santiago', chipClassSantiago);

    // inventário (armas enviadas) — editar aqui, receber na ficha
    var recv = $('santiagoRecv');
    if (recv) {
      clear(recv);
      if (!santiago.armas.length) recv.appendChild(el('span', 'empty-note', 'nenhuma arma enviada ainda'));
      santiago.armas.forEach(function (a) {
        var row = el('div', 'recv-item');
        row.appendChild(el('span', null, '⚔ ' + a.nome));
        var right = el('span');
        right.style.display = 'inline-flex'; right.style.gap = '10px'; right.style.alignItems = 'center';
        right.appendChild(el('span', 'w-dice', a.dano || ''));
        var rm = el('button', 'mini-btn danger', '✕');
        rm.title = 'Retirar do inventário';
        rm.addEventListener('click', function () { removeRecv(a.nome, 'santiago'); });
        right.appendChild(rm);
        row.appendChild(right);
        recv.appendChild(row);
      });
    }
  }

  // ---------- Controles comuns às 3 fichas ----------
  // A Flora sempre pôde mexer em vida, sanidade, atributos e efeitos aqui; Nox e Dante ganhavam só o
  // espelho. Este bloco é um código só atendendo as três: cada ficha entrega o próprio estado e o próprio
  // save pelo prefixo dos ids (floraHpAmt, coelhoHpAmt, santiagoHpAmt...), e os cards ficam com o mesmo poder.
  var SHEET_CTLS = {
    flora: { get: function () { return flora; }, save: save, keys: Object.keys(ATTR_LABELS) },
    coelho: { get: function () { return coelho; }, save: saveCoelho, keys: Object.keys(NOX_ATTR_DEFAULT) },
    santiago: { get: function () { return santiago; }, save: saveSantiago, keys: Object.keys(STG_ATTR_DEFAULT) }
  };
  var SHEET_IDS = Object.keys(SHEET_CTLS);

  // ---------- Fichas canônicas (a 4, a 5 e as que vierem) ----------
  // Ficha "canônica" é a que só tem o que todo mundo tem: duas barras, os 5 atributos, efeitos
  // e armas. Ela não ganha função nova: ganha uma config aqui. O resto do painel (vitais,
  // atributos, chips, inventário, radicais, feed, sincronização entre abas) já é código genérico
  // que atende qualquer id registrado em SHEET_CTLS — é só isso que esta fábrica faz.
  // Contrato de ids no mestre.html (quebrar um nome quebra em silêncio, sem erro na tela):
  //   <id>Portrait <id>Badge <id>HpNome <id>SanNome <id>HpText <id>HpFill <id>HpAmt
  //   <id>SanText <id>SanFill <id>SanAmt <id>Attrs <id>Effects <id>EffectInput <id>EffectAdd
  //   <id>Incap <id>Kill <id>Revive <id>Recv <id>Reload <id>Feed <id>Nome <id>Open
  //   + data-sheet="<id>" nos seis botões de vital do card.
  //   <id>World é OPCIONAL: é onde entra o resumo que a própria ficha escreve no state
  //   (a Clara escreve state.lampiaoResumo, a Vesper escreve state.persResumo). Sem o id no
  //   HTML, o resumo simplesmente não aparece.
  //   f.retrato também é opcional: arte padrão da personagem no card, até ela subir outra.
  //   f.quem TEM que bater com o CONF.quem do js/ficha<n>.js: é por essa palavra que o feed
  //   separado de cada card filtra as rolagens/cliques. O nome bonito do personagem, esse,
  //   você pode trocar na própria ficha (campo do título) que o card acompanha.
  var FICHAS = [
    {
      id: 'ficha4', chave: 'eclipse_ficha4_v1', quem: 'Vesper', nome: 'Vesper', emoji: '🕯️', href: 'ficha4.html',
      hpNome: 'Brasa', sanNome: 'Vínculo', hpMax: 26, sanMax: 100,
      eff: { morto: '☠️ Apagada', incap: '🟡 Vacilando' },
      rot: { morto: '☠️ Apagada', incap: '🟡 Vacilando', cado: 'Caída · brasa a 0', vivo: '✨ Acesa' },
      atr: { forca: 9, destreza: 13, constituicao: 10, inteligencia: 12, carisma: 16 }
    },
    {
      id: 'ficha5', chave: 'eclipse_ficha5_v1', quem: 'Clara', nome: 'Clara Masorack', emoji: '🏮', href: 'ficha5.html',
      retrato: 'img/clara.png', // a arte que o mestre mandou: aparece no card enquanto ela não trocar
      hpNome: 'Vida', sanNome: 'Sanidade', hpMax: 20, sanMax: 100,
      eff: { morto: '☠️ Morta', incap: '🟡 Incapacitada' },
      rot: { morto: '☠️ Morta', incap: '🟡 Incapacitada', cado: 'Caída · 0 de vida', vivo: '🕯️ De lampião aceso' },
      atr: { forca: 9, destreza: 13, constituicao: 10, inteligencia: 16, carisma: 11 }
    }
  ];

  // Lê sem destruir: campo desconhecido (o que a ficha própria guarda) passa batido.
  function fichaRead(f) {
    var s = null;
    try {
      var raw = localStorage.getItem(f.chave);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (typeof s.hp !== 'number') s.hp = f.hpMax;
    if (typeof s.hpMax !== 'number') s.hpMax = f.hpMax;
    if (typeof s.san !== 'number') s.san = f.sanMax;
    if (typeof s.sanMax !== 'number') s.sanMax = f.sanMax;
    if (!Array.isArray(s.status)) s.status = [];
    if (!Array.isArray(s.armas)) s.armas = [];
    if (!s.atributos || typeof s.atributos !== 'object') s.atributos = {};
    Object.keys(ATTR_LABELS).forEach(function (k) {
      if (!s.atributos[k] || typeof s.atributos[k].valor !== 'number') {
        s.atributos[k] = { nome: ATTR_LABELS[k], valor: f.atr[k] };
      }
      s.atributos[k].nome = ATTR_LABELS[k]; // mesmo nome em todas as fichas; só o valor difere
    });
    s.hp = clamp(s.hp, 0, s.hpMax);
    s.san = clamp(s.san, 0, s.sanMax);
    return s;
  }

  function fichaWrite(f) {
    try { localStorage.setItem(f.chave, JSON.stringify(f.s)); }
    catch (e) { alert('Não consegui salvar (armazenamento cheio?).'); }
  }

  // o nome que ela usa na mesa: o que ela escreveu no topo da ficha, ou o rótulo da config
  function fichaNome(f) { return (f.s && f.s.nome) ? f.s.nome : f.nome; }

  function fichaIncapacitar(f) {
    statusRemove(f.s, f.eff.morto);
    statusAdd(f.s, f.eff.incap);
    f.save();
  }
  function fichaMatar(f) {
    if (!confirm('Tem certeza? Isso derruba ' + fichaNome(f) + ' de uma vez (' + f.hpNome.toLowerCase() + ' e ' + f.sanNome.toLowerCase() + ' a 0).')) return;
    statusRemove(f.s, f.eff.incap);
    f.s.hp = 0; f.s.san = 0;
    if (f.s.status.indexOf(f.eff.morto) === -1) f.s.status.unshift(f.eff.morto);
    f.save();
  }
  function fichaRestaurar(f) {
    statusRemove(f.s, f.eff.morto);
    statusRemove(f.s, f.eff.incap);
    f.s.hp = f.s.hpMax; f.s.san = f.s.sanMax;
    f.save();
  }

  function chipClassFicha(f) {
    return function (n) {
      if (n === f.eff.morto) return ' dead';
      if (n === f.eff.incap) return ' incap';
      return /·\s*−\s*\d+$/.test(String(n)) ? ' dead' : ''; // efeito que atrapalha: vermelho
    };
  }

  function renderFicha(f) {
    var port = $(f.id + 'Portrait'); if (!port) return; // card ainda não no HTML: o resto do painel segue
    clear(port);
    var psrc = null;
    try { var p = JSON.parse(localStorage.getItem(f.chave + '_portrait')); if (p && p.src) psrc = p.src; } catch (e) {}
    if (psrc) { var img = el('img'); img.src = psrc; img.alt = fichaNome(f); port.appendChild(img); }
    else if (f.retrato) { var im2 = el('img'); im2.src = f.retrato; im2.alt = fichaNome(f); port.appendChild(im2); }
    else { port.textContent = f.emoji; }

    // o resumo que a própria ficha escreve: state.persResumo (as três da Vesper) ou
    // state.lampiaoResumo (o lampião da Clara). Ficha sem poder próprio não escreve nada,
    // e o chip simplesmente não muda.
    var resumo = f.s.persResumo || f.s.lampiaoResumo;
    var wo = $(f.id + 'World');
    if (wo && resumo) {
      clear(wo);
      var wc = el('span', 'chip ro');
      wc.textContent = resumo;
      wo.appendChild(wc);
    }

    var nm = $(f.id + 'Nome'); if (nm) nm.textContent = fichaNome(f);
    var open = $(f.id + 'Open'); if (open) open.href = f.href;

    var badge = $(f.id + 'Badge');
    if (badge) {
      badge.className = 'badge';
      if (f.s.status.indexOf(f.eff.morto) !== -1) { badge.classList.add('dead'); badge.textContent = f.rot.morto; }
      else if (f.s.hp <= 0) { badge.classList.add('dead'); badge.textContent = f.rot.cado; }
      else if (f.s.status.indexOf(f.eff.incap) !== -1) { badge.classList.add('incap'); badge.textContent = f.rot.incap; }
      else { badge.classList.add('alive'); badge.textContent = f.rot.vivo; }
    }

    var hn = $(f.id + 'HpNome'); if (hn) hn.textContent = f.hpNome;
    var sn = $(f.id + 'SanNome'); if (sn) sn.textContent = f.sanNome;
    var hpFill = $(f.id + 'HpFill'), hpText = $(f.id + 'HpText');
    if (hpFill) hpFill.style.width = clamp((f.s.hp / f.s.hpMax) * 100, 0, 100) + '%';
    if (hpText) hpText.textContent = f.s.hp + ' / ' + f.s.hpMax;
    var sanFill = $(f.id + 'SanFill'), sanText = $(f.id + 'SanText');
    if (sanFill) sanFill.style.width = clamp((f.s.san / f.s.sanMax) * 100, 0, 100) + '%';
    if (sanText) sanText.textContent = f.s.san + ' / ' + f.s.sanMax;

    renderAttrs(f.id);
    renderEffectChips(f.id, chipClassFicha(f));

    var recv = $(f.id + 'Recv');
    if (recv) {
      clear(recv);
      if (!f.s.armas.length) recv.appendChild(el('span', 'empty-note', 'nenhuma arma enviada ainda'));
      f.s.armas.forEach(function (a) {
        var row = el('div', 'recv-item');
        row.appendChild(el('span', null, '⚔ ' + a.nome));
        var right = el('span');
        right.style.display = 'inline-flex'; right.style.gap = '10px'; right.style.alignItems = 'center';
        right.appendChild(el('span', 'w-dice', a.dano || ''));
        var rm = el('button', 'mini-btn danger', '✕');
        rm.title = 'Retirar do inventário';
        rm.addEventListener('click', function () { removeRecv(a.nome, f.id); });
        right.appendChild(rm);
        row.appendChild(right);
        recv.appendChild(row);
      });
    }
  }

  // registra: a partir daqui os controles comuns (vitalsStep, effectSend, renderAttrs,
  // renderEffectChips e o laço de data-sheet) atendem essas fichas sem uma linha nova
  FICHAS.forEach(function (f) {
    f.s = fichaRead(f);
    f.save = function () { fichaWrite(f); renderFicha(f); renderFeeds(); };
    SHEET_CTLS[f.id] = { get: function () { return f.s; }, save: f.save, keys: Object.keys(ATTR_LABELS) };
    SHEET_IDS.push(f.id);
  });
  var FICHA_POR_ID = {};
  FICHAS.forEach(function (f) { FICHA_POR_ID[f.id] = f; });

  // para quem o arsenal entrega: as 3 fixas + as canônicas
  var CAT_ALVOS = [
    { alvo: 'flora', nome: 'Flora' },
    { alvo: 'nox', nome: 'Nox' },
    { alvo: 'santiago', nome: 'Dante' }
  ];
  FICHAS.forEach(function (f) { CAT_ALVOS.push({ alvo: f.id, nome: f.nome, ficha: f }); });

  // status: limite de 6 e sem repetir, igual pra todo mundo
  function statusAdd(s, nome) {
    nome = String(nome || '').trim();
    if (!nome) return;
    if (s.status.indexOf(nome) !== -1) return;
    if (s.status.length >= STATUS_MAX) { alert('Limite de ' + STATUS_MAX + ' efeitos ativos.'); return; }
    s.status.push(nome);
  }
  function statusRemove(s, nome) {
    var i = s.status.indexOf(nome);
    if (i !== -1) s.status.splice(i, 1);
  }

  // vida / sanidade: −quantidade, +quantidade, ou direto no máximo
  function vitalsStep(id, bar, modo) {
    var ctl = SHEET_CTLS[id]; if (!ctl) return;
    var s = ctl.get();
    var campo = bar === 'hp' ? 'hp' : 'san';
    var max = bar === 'hp' ? s.hpMax : s.sanMax;
    if (modo === 'full') { s[campo] = max; ctl.save(); return; }
    var amt = parseInt($(id + (bar === 'hp' ? 'HpAmt' : 'SanAmt')).value, 10) || 0;
    s[campo] = modo === 'dmg' ? clamp(s[campo] - amt, 0, max) : clamp(s[campo] + amt, 0, max);
    ctl.save();
  }

  function effectSend(id) {
    var ctl = SHEET_CTLS[id]; if (!ctl) return;
    var input = $(id + 'EffectInput'); if (!input) return;
    var nome = input.value.trim();
    input.value = '';
    if (!nome) return;
    statusAdd(ctl.get(), nome);
    ctl.save();
  }

  // caixinhas de atributo editáveis (0 a 30, o que passar volta arrumado)
  function renderAttrs(id) {
    var ctl = SHEET_CTLS[id];
    var box = $(id + 'Attrs'); if (!box || !ctl) return;
    var s = ctl.get();
    clear(box);
    ctl.keys.forEach(function (k) {
      var a = s.atributos[k]; if (!a) return; // os leitores já garantem as 5 chaves
      var cell = el('div', 'm-attr');
      cell.appendChild(el('div', 'a-nome', a.nome || ATTR_LABELS[k] || k));
      var inp = el('input');
      inp.type = 'number'; inp.min = '0'; inp.max = '30'; inp.value = a.valor;
      inp.addEventListener('change', function () {
        a.valor = clamp(parseInt(inp.value, 10), 0, 30);
        inp.value = a.valor;
        ctl.save();
      });
      cell.appendChild(inp);
      box.appendChild(cell);
    });
  }

  // cores das fichas: morta/incapacitado e marca negativa de carta (· −N) ficam vermelhas
  function chipClassFlora(n) { return n === EFF_MORTA ? ' dead' : (n === EFF_INCAP ? ' incap' : ''); }
  function chipClassNox(n) { return n === NOX_EFF_MORTO ? ' dead' : ((n === NOX_EFF_INCAP || n === EFF_DESFIA) ? ' incap' : ''); }
  function chipClassSantiago(n) {
    return (n === STG_EFF_MORTO || /·\s*−\s*\d+$/.test(String(n))) ? ' dead' : (n === STG_EFF_INCAP ? ' incap' : '');
  }

  function renderEffectChips(id, clsOf) {
    var ctl = SHEET_CTLS[id];
    var box = $(id + 'Effects'); if (!box || !ctl) return;
    var s = ctl.get();
    clear(box);
    if (!s.status.length) { box.appendChild(el('span', 'empty-note', 'sem efeitos ativos')); return; }
    s.status.forEach(function (nome) {
      var c = el('span', 'chip' + (clsOf ? clsOf(nome) : ''), nome);
      c.title = 'Clique para remover';
      c.addEventListener('click', function () { statusRemove(s, nome); ctl.save(); });
      box.appendChild(c);
    });
  }

  // ---------- Render ----------
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function render() {
    // retrato
    var port = $('floraPortrait');
    clear(port);
    var psrc = null;
    try { var p = JSON.parse(localStorage.getItem(PORTRAIT_KEY)); if (p && p.src) psrc = p.src; } catch (e) {}
    if (psrc) {
      var img = el('img'); img.src = psrc; img.alt = 'Flora'; port.appendChild(img);
    } else {
      port.textContent = '🩰';
    }

    // badge
    var badge = $('floraBadge');
    badge.className = 'badge';
    if (hasEffect(EFF_MORTA)) { badge.classList.add('dead'); badge.textContent = 'Morta'; }
    else if (flora.hp <= 0) { badge.classList.add('dead'); badge.textContent = 'Caída · 0 de vida'; }
    else if (hasEffect(EFF_INCAP)) { badge.classList.add('incap'); badge.textContent = 'Incapacitada'; }
    else { badge.classList.add('alive'); badge.textContent = 'Viva'; }

    // vida
    var hpPct = clamp((flora.hp / flora.hpMax) * 100, 0, 100);
    $('floraHpFill').style.width = hpPct + '%';
    $('floraHpText').textContent = flora.hp + ' / ' + flora.hpMax;
    // sanidade
    var sanPct = clamp((flora.san / flora.sanMax) * 100, 0, 100);
    $('floraSanFill').style.width = sanPct + '%';
    $('floraSanText').textContent = flora.san + ' / ' + flora.sanMax;

    // atributos
    renderAttrs('flora');

    // efeitos
    renderEffectChips('flora', chipClassFlora);

    // armas recebidas
    var recv = $('floraRecv');
    clear(recv);
    if (!flora.armas.length) recv.appendChild(el('span', 'empty-note', 'nenhuma arma enviada ainda'));
    flora.armas.forEach(function (a) {
      var row = el('div', 'recv-item');
      row.appendChild(el('span', null, '⚔ ' + a.nome));
      var right = el('span');
      right.style.display = 'inline-flex'; right.style.gap = '10px'; right.style.alignItems = 'center';
      right.appendChild(el('span', 'w-dice', a.dano || ''));
      var rm = el('button', 'mini-btn danger', '✕');
      rm.title = 'Remover do inventário';
      rm.addEventListener('click', function () { removeRecv(a.nome, 'flora'); });
      right.appendChild(rm);
      row.appendChild(right);
      recv.appendChild(row);
    });

    // catálogo
    var cat = $('catalogList');
    clear(cat);
    if (!catalogo.length) cat.appendChild(el('span', 'empty-note', 'o arsenal está vazio — cadastre a primeira arma acima'));
    catalogo.forEach(function (w) {
      var row = el('div', 'cat-item');
      row.appendChild(el('span', null, '🗡 ' + w.nome));
      var actions = el('div', 'cat-actions');
      actions.appendChild(el('span', 'w-dice', w.dano || ''));
      // um botão de envio por ficha — inclusive as que chegarem depois, que entram sozinhas
      // pelo CAT_ALVOS (por isso não há mais botão escrito à mão aqui).
      CAT_ALVOS.forEach(function (a) {
        var b = el('button', 'mini-btn ok', '➤ Enviar p/ ' + (a.ficha ? fichaNome(a.ficha) : a.nome));
        b.addEventListener('click', function () { sendCatalog(w.id, a.alvo); });
        actions.appendChild(b);
      });
      var del = el('button', 'mini-btn danger', '✕');
      del.title = 'Excluir do arsenal';
      del.addEventListener('click', function () { delCatalog(w.id); });
      actions.appendChild(del);
      row.appendChild(actions);
      cat.appendChild(row);
    });
  }

  // ---------- Ligações ----------
  // vida e sanidade: um laço só pras 3 fichas — o data-sheet diz de quem é o botão
  document.querySelectorAll('[data-hp], [data-san]').forEach(function (btn) {
    var isHp = btn.hasAttribute('data-hp');
    var modo = isHp ? btn.dataset.hp : btn.dataset.san;
    btn.addEventListener('click', function () {
      vitalsStep(btn.dataset.sheet || 'flora', isHp ? 'hp' : 'san', modo);
    });
  });
  // enviar efeito: a mesma caixa nas 3 fichas (Enter vale)
  SHEET_IDS.forEach(function (id) {
    var add = $(id + 'EffectAdd'), input = $(id + 'EffectInput');
    if (add) add.addEventListener('click', function () { effectSend(id); });
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); effectSend(id); }
    });
  });
  $('floraIncap').addEventListener('click', incapacitar);
  $('floraKill').addEventListener('click', matar);
  $('floraRevive').addEventListener('click', restaurar);
  if ($('noxIncap')) $('noxIncap').addEventListener('click', noxIncapacitar);
  if ($('noxKill')) $('noxKill').addEventListener('click', noxMatar);
  if ($('noxRevive')) $('noxRevive').addEventListener('click', noxRestaurar);
  if ($('santiagoIncap')) $('santiagoIncap').addEventListener('click', santiagoIncapacitar);
  if ($('santiagoKill')) $('santiagoKill').addEventListener('click', santiagoMatar);
  if ($('santiagoRevive')) $('santiagoRevive').addEventListener('click', santiagoRestaurar);
  $('floraReload').addEventListener('click', function () { flora = readFlora(); render(); renderFeeds(); });
  if ($('coelhoReload')) $('coelhoReload').addEventListener('click', function () { coelho = readCoelho(); renderCoelho(); renderFeeds(); });
  if ($('santiagoReload')) $('santiagoReload').addEventListener('click', function () { santiago = readSantiago(); renderSantiago(); renderFeeds(); });
  // fichas canônicas: as mesmas três ações radicais + sincronizar, todas ligadas pela config
  FICHAS.forEach(function (f) {
    if ($(f.id + 'Incap')) $(f.id + 'Incap').addEventListener('click', function () { fichaIncapacitar(f); });
    if ($(f.id + 'Kill')) $(f.id + 'Kill').addEventListener('click', function () { fichaMatar(f); });
    if ($(f.id + 'Revive')) $(f.id + 'Revive').addEventListener('click', function () { fichaRestaurar(f); });
    if ($(f.id + 'Reload')) $(f.id + 'Reload').addEventListener('click', function () { f.s = fichaRead(f); renderFicha(f); renderFeeds(); });
  });

  // armas
  $('wAdd').addEventListener('click', addCatalog);
  $('wNome').addEventListener('keydown', function (e) { if (e.key === 'Enter') addCatalog(); });
  $('wDano').addEventListener('keydown', function (e) { if (e.key === 'Enter') addCatalog(); });

  // ---------- Inimigos em cena (bestiário compartilhado) ----------
  // A lista inteira (ler, criar, machucar, tirar) mora em js/inimigos.js, que as 4 páginas carregam:
  // aqui é só o editor do mestre; nas fichas é a mesma chave desenhada sem nenhum campo editável.
  function renderBestiario() {
    if (!window.EclipseInimigos) return; // veio cache antigo sem o arquivo? o resto do painel segue funcionando
    EclipseInimigos.renderEditor($('mobEditList'), renderBestiario);
  }
  function criarInimigo() {
    if (!window.EclipseInimigos) { alert('Falta o arquivo js/inimigos.js (Ctrl+F5).'); return; }
    var nome = $('mobNome').value.trim();
    if (!EclipseInimigos.add(nome, $('mobHp').value, $('mobSan').value)) return;
    $('mobNome').value = '';
    $('mobNome').focus();
    renderBestiario();
  }
  if ($('mobAdd')) $('mobAdd').addEventListener('click', criarInimigo);
  if ($('mobNome')) $('mobNome').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); criarInimigo(); } });

  // ---------- Rolagem do Mestre + HISTÓRICO COMPARTILHADO (mesma chave da Flora) ----------
  var ROLL_KEY = 'eclipse_roll_log';
  var ROLL_MAX = 60;
  function readRolls() { try { var l = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeRolls(l) { try { localStorage.setItem(ROLL_KEY, JSON.stringify(l)); } catch (e) {} }
  // Monitor de atividade dos jogadores (cliques/mexe) — chave global compartilhada com as fichas.
  var ACT_KEY = 'eclipse_activity';
  function readActs() { try { var l = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  // Migração única: engole o antigo histórico só-do-mestre para dentro do global.
  (function () {
    try {
      var old = JSON.parse(localStorage.getItem('eclipse_mestre_log') || '[]');
      if (Array.isArray(old) && old.length && !readRolls().length) {
        writeRolls(old.map(function (l) {
          return { who: 'Mestre', txt: (l.label || 'Rolagem') + ' · ' + (l.formula || ''), total: l.total, detalhe: l.detail || '', classe: l.crit ? 'crit' : (l.fumble ? 'fumble' : ''), hora: l.hora || '', t: Date.now() };
        }).slice(0, ROLL_MAX));
      }
      localStorage.removeItem('eclipse_mestre_log');
    } catch (e) {}
  })();

  function rollND(tipo, qtde) {
    var res = [], soma = 0;
    for (var i = 0; i < qtde; i++) { var r = 1 + Math.floor(Math.random() * tipo); res.push(r); soma += r; }
    return { resultados: res, soma: soma };
  }

  function masterRoll(tipo, qtde, bonus, label) {
    var r = rollND(tipo, qtde);
    var total = r.soma + bonus;
    var formula = (qtde > 1 ? qtde : '') + 'd' + tipo + (bonus ? (bonus >= 0 ? ' + ' + bonus : ' − ' + (-bonus)) : '');
    var crit = (qtde === 1 && tipo === 20 && r.resultados[0] === 20);
    var fumble = (qtde === 1 && tipo === 20 && r.resultados[0] === 1);
    var lbl = (label || '').trim();
    var entry = {
      who: 'Mestre',
      txt: (lbl || 'Rolagem do mestre') + ' · ' + formula,
      total: total,
      detalhe: r.resultados.join(', '),
      classe: crit ? 'crit' : (fumble ? 'fumble' : ''),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      t: Date.now()
    };
    var list = readRolls(); list.unshift(entry); writeRolls(list.slice(0, ROLL_MAX));
    renderMLog();
    return entry;
  }

  function renderMLog() {
    var ul = $('mlogList'); if (!ul) return;
    clear(ul);
    var mlog = readRolls(); // histórico GLOBAL (mestre + todos os jogadores)
    var count = $('mlogCount'); if (count) count.textContent = mlog.length + (mlog.length === 1 ? ' rolagem' : ' rolagens');
    if (!mlog.length) { ul.appendChild(el('li', 'empty-note', 'nenhuma rolagem ainda — role um dado acima.')); return; }
    mlog.forEach(function (l) {
      var li = document.createElement('li');
      li.className = 'mlog-item' + (l.classe === 'crit' ? ' crit' : (l.classe === 'fumble' ? ' fumble' : ''));
      li.appendChild(el('span', 'mlog-who' + (l.who === 'Mestre' ? ' mestre' : ''), l.who || 'Flora'));
      var left = el('span', 'mlog-left');
      var linha = el('b', null, (l.classe === 'crit' ? '✦ ' : l.classe === 'fumble' ? '✧ ' : '') + (l.txt || 'Rolagem'));
      linha.title = linha.textContent; // a linha corta em ... pra não esticar a página: no hover ela aparece inteira
      left.appendChild(linha);
      left.appendChild(el('span', 'mlog-form', l.detalhe != null ? '[' + l.detalhe + ']' : ''));
      li.appendChild(left);
      li.appendChild(el('span', 'mlog-total', String(l.total)));
      li.appendChild(el('span', 'mlog-hora', l.hora || ''));
      ul.appendChild(li);
    });
    renderFeeds();
  }

  // Feed por ficha: mistura os cliques (eclipse_activity) com as rolagens (eclipse_roll_log) daquele jogador.
  function feedFor(who) {
    // entradas antigas da ficha 2 (pré-rename, who='Coelho') também pertencem ao Nox
    // idem ficha 3: ele se chamava Santiago antes da v1.31.3, e o histórico dele não apaga
    var aliases = { Nox: { Coelho: 1, Nox: 1 }, Dante: { Santiago: 1, Dante: 1 } };
    var ok = function (w) { var a = aliases[who]; return a ? !!a[w] : w === who; };
    var rolls = readRolls().filter(function (l) { return ok(l.who || 'Flora'); });
    var acts = readActs().filter(function (l) { return ok(l.who || 'Flora'); });
    var items = rolls.map(function (l) {
      return { t: l.t || 0, hora: l.hora, kind: 'roll', classe: l.classe,
        txt: (l.txt || 'Rolagem') + ' → ' + (l.detalhe != null ? '[' + l.detalhe + '] ' : '') + '= ' + l.total };
    }).concat(acts.map(function (l) {
      return { t: l.t || 0, hora: l.hora, kind: 'act', classe: '', txt: l.act };
    }));
    items.sort(function (a, b) { return b.t - a.t; });
    return items.slice(0, 10);
  }
  function renderFeed(who, ulId) {
    var ul = $(ulId); if (!ul) return;
    clear(ul);
    var items = feedFor(who);
    if (!items.length) { ul.appendChild(el('li', 'feed-empty', 'sem atividade ainda')); return; }
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'feed-item ' + it.kind + (it.classe === 'crit' ? ' crit' : (it.classe === 'fumble' ? ' fumble' : ''));
      var tx = el('span', 'feed-txt', it.txt);
      tx.title = it.txt; // idem: o ellipsis esconde o fim da frase, o hover devolve
      li.appendChild(tx);
      li.appendChild(el('span', 'feed-hora', it.hora || ''));
      ul.appendChild(li);
    });
  }
  function renderFeeds() {
    renderFeed('Flora', 'floraFeed');
    renderFeed('Nox', 'coelhoFeed');
    renderFeed('Dante', 'santiagoFeed');
    FICHAS.forEach(function (f) { renderFeed(f.quem, f.id + 'Feed'); });
  }

  function doMasterRoll() {
    var tipo = parseInt($('mrTipo').value, 10);
    var qtde = clamp(parseInt($('mrQtd').value, 10) || 1, 1, 20);
    var bonus = parseInt($('mrBonus').value, 10) || 0;
    var e = masterRoll(tipo, qtde, bonus, $('mrLabel') ? $('mrLabel').value : '');
    var out = $('mrResult');
    out.textContent = e.txt + ':  [' + e.detalhe + ']  =  ' + e.total + (e.classe === 'crit' ? '  ✦ crítico!' : e.classe === 'fumble' ? '  ✧ falha crítica…' : '');
    out.className = 'mr-result show' + (e.classe === 'crit' ? ' crit' : e.classe === 'fumble' ? ' fumble' : '');
  }

  function quickRoll(code) {
    var m = String(code).toLowerCase().match(/^(\d*)d(\d+)$/);
    if (!m) return;
    var qtde = parseInt(m[1], 10) || 1;
    var tipo = parseInt(m[2], 10);
    $('mrTipo').value = String(tipo);
    $('mrQtd').value = String(qtde);
    doMasterRoll();
  }

  if ($('mrRoll')) $('mrRoll').addEventListener('click', doMasterRoll);
  if ($('mrLabel')) $('mrLabel').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doMasterRoll(); } });
  document.querySelectorAll('[data-quick]').forEach(function (b) {
    b.addEventListener('click', function () { quickRoll(b.dataset.quick); });
  });
  if ($('mlogClear')) $('mlogClear').addEventListener('click', function () {
    if (!readRolls().length) return;
    if (!confirm('Isso limpa o HISTÓRICO COMPLETO de rolagem — as suas E as de todos os jogadores (Flora etc). Continuar?')) return;
    writeRolls([]); renderMLog();
    var out = $('mrResult'); if (out) { out.textContent = ''; out.className = 'mr-result'; }
  });

  // sincroniza quando outra aba (a ficha da Flora ou do Coelho) salva
  window.addEventListener('storage', function (e) {
    if (window.EclipseInimigos && e.key === EclipseInimigos.KEY) { renderBestiario(); return; }
    if (e.key === ROLL_KEY) { renderMLog(); return; }
    if (e.key === ACT_KEY) { renderFeeds(); return; }
    if (e.key === COELHO_KEY || e.key === COELHO_PORTRAIT_KEY) { coelho = readCoelho(); renderCoelho(); return; }
    if (e.key === SANTIAGO_KEY || e.key === SANTIAGO_PORTRAIT_KEY) { santiago = readSantiago(); renderSantiago(); return; }
    for (var i = 0; i < FICHAS.length; i++) {
      var f = FICHAS[i];
      if (e.key === f.chave || e.key === f.chave + '_portrait') { f.s = fichaRead(f); renderFicha(f); return; }
    }
    if (e.key === FLORA_KEY || e.key === PORTRAIT_KEY || e.key === CAT_KEY) {
      flora = readFlora(); catalogo = readCat(); render();
    }
  });

  render();
  renderCoelho();
  renderSantiago();
  FICHAS.forEach(function (f) { renderFicha(f); });
  renderBestiario();
  renderMLog();
})();
