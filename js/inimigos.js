/* ===== Inimigos em cena — o bestiário que o MESTRE cria e os JOGADORES veem =====
   Uma chave só (eclipse_inimigos_v1) compartilhada entre as 4 páginas.
   Quem cria, renomeia e tira da cena é o painel do mestre.
   O mestre chama EclipseInimigos.renderEditor() no bloco dele (#mobEditList).
   Nada aqui encosta no estado das fichas (vida/sanidade/marcas de cada personagem).

   DOIS MUDARAM EM 07/10, por ditado direto do mestre, e os dois merecem a cara marcada:

   1) ACERTO NÃO EXISTE MAIS. "quero que acertem e ponto a não ser que role tipo uma destreza
      do meu bicho pra desviar": quem bate NÃO rola pra ver se encosta — o dano vai direto no
      bicho. A única defesa é dele: **d10 + Destreza do bicho**, e ele só desvia se passar da
      PAREDE (12). É uma rolagem do alvo, não do atacante: por isso mora aqui, no bestiário.

   2) A FICA AGORA ESCREVE NO BESTIÁRIO. Durante dez versões a regra era "a ficha nunca encosta
      no bestiário" e a linha do jogador era leitura pura. Ele pediu o contrário, então a linha
      dos jogadores ganhou `🗡 bater`, que desconta a vida do bicho na mesma chave que o painel
      do mestre lê — com o desvio rolado no caminho, o bilhete na atividade da mesa e o preço
      do massacre do Vesper Graves cobrado quando a cabeça cai (js/extase.js). O mestre
      continua dono de qualquer número: os campos dele seguem ali, e ele pode corrigir tudo. */
(function (global) {
  'use strict';

  var KEY = 'eclipse_inimigos_v1';
  var MAX = 6;        // mais que isso estoura a tela do mestre e a aba dos jogadores
  var NOME_MAX = 30;
  var DEST_MAX = 20;  // a Destreza do bicho, de 0 a 20 — ninguém precisa de mais que isso
  /* A PAREDE do desvio: o bicho rola d10 + Destreza dele e SÓ desvia se somar isto ou mais.
     Número escolhido para que um bicho comum (Destreza 0 ou 1) quase nunca desvie — com 0 ele
     não tem chance nenhuma, com 2 desvia em 10% dos golpes, com 5 em 40%. É o único número
     desta regra e está escrito na tela, porque conta escondida é conta que a mesa desconfia. */
  var PAREDE = 12;
  var doc = global.document;

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function clampInt(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }

  // um bicho sempre devolvido inteiro, mesmo vindo de um JSON pela metade
  function norm(e) {
    if (!e || typeof e !== 'object') return null;
    var hpMax = clampInt(e.hpMax, 1, 999);
    var sanMax = clampInt(e.sanMax, 0, 999);
    var id = Number(e.id);
    if (!isFinite(id) || id <= 0) id = Date.now();
    return {
      id: id,
      nome: String(e.nome == null ? '' : e.nome).slice(0, NOME_MAX),
      hpMax: hpMax,
      hp: clampInt(e.hp, 0, hpMax),
      sanMax: sanMax,
      san: clampInt(e.san, 0, sanMax),
      /* Destreza do bicho (07/10): o "destreza do meu bicho pra desviar" que o mestre pediu.
         Bicho criado antes de hoje não tem o campo e vale 0 — ou seja, não desvia de nada,
         exatamente como a mesa funcionava. Ele põe a destreza no painel dele quando quiser. */
      dest: clampInt(e.dest, 0, DEST_MAX)
    };
  }

  function read() {
    var l;
    try { l = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) return [];
    return l.map(norm).filter(Boolean).slice(0, MAX);
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; /* armazenamento cheio: a tela segue mostrando o que estava */ }
  }
  function add(nome, hp, san, dest) {
    var l = read();
    if (l.length >= MAX) { alert('Já tem ' + MAX + ' inimigos em cena — tire um antes de criar outro.'); return false; }
    nome = String(nome || '').trim().slice(0, NOME_MAX) || ('Inimigo ' + (l.length + 1));
    var hpMax = clampInt(hp, 1, 999);
    var sanMax = clampInt(san, 0, 999);
    l.push({ id: Date.now(), nome: nome, hpMax: hpMax, hp: hpMax, sanMax: sanMax, san: sanMax,
             dest: clampInt(dest, 0, DEST_MAX) });
    return write(l);
  }
  function patch(id, campo, valor) {
    var l = read(), achou = false;
    l.forEach(function (e) {
      if (!e || e.id !== id) return;
      achou = true;
      if (campo === 'nome') { e.nome = String(valor || '').slice(0, NOME_MAX); return; }
      if (campo === 'hp') { e.hp = clampInt(valor, 0, e.hpMax); return; }
      if (campo === 'hpMax') { e.hpMax = clampInt(valor, 1, 999); if (e.hp > e.hpMax) e.hp = e.hpMax; return; }
      if (campo === 'san') { e.san = clampInt(valor, 0, e.sanMax); return; }
      if (campo === 'sanMax') { e.sanMax = clampInt(valor, 0, 999); if (e.san > e.sanMax) e.san = e.sanMax; return; }
      if (campo === 'dest') { e.dest = clampInt(valor, 0, DEST_MAX); }
    });
    if (!achou) return false;
    return write(l);
  }
  function remove(id) { return write(read().filter(function (e) { return e.id !== id; })); }

  /* ---------- 07/10: bater direto na ficha ----------
     `machucar` é a única porta de dano desta chave, e ela faz as três coisas que precisam
     acontecer juntas para a mesa não ter que confiar na palavra de ninguém:
       1) o golpe ENTRE sem teste de acerto (o ataque é automático — foi o que ele mandou);
       2) o DESVIO é do bicho: d10 + Destreza dele, e só vale se passar da PAREDE;
       3) o que aconteceu vira ROLAGEM no histórico compartilhado e BILHETE na atividade, para
          o mestre ver quem bateu quanto em quem sem precisar perguntar.
     Se a cabeça caiu, chama js/extase.js: é ali que mora o preço de matar (o −1 de Sanidade do
     Vesper Graves com a terceira foice na mão). Esta função não sabe quem é o Vesper — só sabe
     perguntar à mesa "alguém paga alguma coisa por esta morte?". */
  function d10() { return 1 + Math.floor(Math.random() * 10); }

  function bilhete(who, act) {
    var l = [];
    try { l = JSON.parse(localStorage.getItem('eclipse_activity') || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({ who: who, act: String(act).slice(0, 80),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    try { localStorage.setItem('eclipse_activity', JSON.stringify(l.slice(0, 200))); } catch (e) {}
  }
  /* A mesma chave que as fichas usam para rolagens (who/txt/total/detalhe/classe/hora/t). */
  function rolagem(entry) {
    var l = [];
    try { l = JSON.parse(localStorage.getItem('eclipse_roll_log') || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    l.unshift({
      who: entry.who || 'a mesa', txt: entry.txt || 'Golpe', total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '', classe: entry.classe || '',
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now()
    });
    try { localStorage.setItem('eclipse_roll_log', JSON.stringify(l.slice(0, 120))); } catch (e) {}
  }
  /* Quem está batendo, na boca da mesa: nome lido da própria ficha sincronizada. Sem o
     js/extase.js na página (cache velha) volta o WHO do motor da ficha, e na pior 'a mesa' —
     um golpe sem nome não é motivo para o dano não acontecer. */
  function quemBate() {
    var X = global.ECLIPSE_EXTASE;
    if (X) {
      var c = X.chaveDaPagina();
      if (c) return X.nomeNa(c);
    }
    var a = global.FICHA_API;
    if (a && a.WHO) return String(a.WHO);
    return 'a mesa';
  }
  function chavePagina() {
    var X = global.ECLIPSE_EXTASE;
    if (X) { try { return X.chaveDaPagina() || ''; } catch (e) { return ''; } }
    return '';
  }

  function machucar(id, valor) {
    var l = read(), alvo = null;
    l.forEach(function (e) { if (e.id === id) alvo = e; });
    if (!alvo) return { ok: false, msg: '⚠ esse bicho já saiu da cena.' };
    var dano = clampInt(valor, 0, 999);
    if (dano <= 0) return { ok: false, msg: '⚠ escreva o número que a sua rolagem deu.' };
    if (alvo.hp <= 0) return { ok: false, msg: '🟥 ' + alvo.nome + ' já está caído — não adianta bater.' };
    var quem = quemBate();
    /* O desvio, na frente de todos: rola antes de descontar, e o resultado vai para o
       histórico compartilhado. Destreza 0 = sem chance nenhuma (d10 nunca chega a 12). */
    var face = d10(), soma = face + (alvo.dest || 0), desviou = soma >= PAREDE;
    if (desviou) {
      rolagem({ who: quem, txt: '🌀 ' + alvo.nome + ' desviou · d10 + Destreza ' + (alvo.dest || 0),
        total: soma, detalhe: String(face), classe: '' });
      bilhete(quem, '🌀 ' + alvo.nome + ' desviou do golpe (' + dano + ')');
      return { ok: true, desviou: true, face: face, soma: soma,
        msg: '🌀 ' + alvo.nome + ' rolou d10 ' + face + ' + Destreza ' + (alvo.dest || 0) + ' = ' + soma +
          ' e passou de ' + PAREDE + ': ele DESVIOU. O dano ' + dano + ' não aconteceu.' };
    }
    var antes = alvo.hp;
    alvo.hp = clampInt(alvo.hp - dano, 0, alvo.hpMax);
    if (!write(l)) return { ok: false, msg: '⚠ não deu para gravar (armazenamento cheio). Tente de novo.' };
    var caiu = alvo.hp === 0 && antes > 0;
    var pago = 0;
    if (caiu) {
      var X = global.ECLIPSE_EXTASE;
      if (X && typeof X.porMorte === 'function') { try { pago = X.porMorte(chavePagina()) || 0; } catch (e) { pago = 0; } }
    }
    rolagem({ who: quem, txt: '🗡 dano em ' + alvo.nome + ' (sem teste de acerto)',
      total: alvo.hp, detalhe: '-' + dano + ' · ficou ' + antes + ' → ' + alvo.hp, classe: caiu ? 'crit' : '' });
    bilhete(quem, '🗡 machucou ' + alvo.nome + ' em ' + dano + (caiu ? ' · CAIU' : ''));
    return { ok: true, desviou: false, dano: dano, hp: alvo.hp, hpMax: alvo.hpMax, caiu: caiu, pago: pago,
      msg: '🗡 ' + dano + ' de dano em ' + alvo.nome + ': vida ' + antes + ' → ' + alvo.hp + ' / ' + alvo.hpMax +
        (caiu ? ' · 🟥 ELE CAIU.' : '') +
        (pago ? ' · ☠ você pagou ' + pago + ' de Sanidade por essa morte.' : '') };
  }

  // ---------- desenho ----------
  function bar(tipo, val, max) {
    var wrap = el('div', 'mob-bar');
    var fill = el('div', 'mob-fill ' + tipo);
    fill.style.width = (max > 0 ? Math.round((val / max) * 100) : 0) + '%';
    wrap.appendChild(fill);
    wrap.appendChild(el('span', 'mob-bar-txt', val + ' / ' + max));
    return wrap;
  }
  function tagsOf(e) {
    var t = [];
    if (e.hpMax > 0 && e.hp === 0) t.push(el('span', 'mob-tag caido', '🟥 caído'));
    if (e.sanMax > 0 && e.san === 0) t.push(el('span', 'mob-tag choque', '😵 sem sanidade'));
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); } // esvazia sem tocar em innerHTML

  /* A última resposta de `machucar` por bicho. Moram fora do desenho pelo mesmo motivo do
     bloco do massacre: bater redesenha a linha inteira (é assim que a barra cai na frente de
     todos), e o parágrafo onde a frase seria escrita deixa de existir no caminho. */
  var MSG_HIT = {};

  function renderList(box, editable, after, recria) {
    if (!box) return;
    var lista = read();
    // recriar a linha tiraria o foco de quem está digitando (ou clicando nas setinhas) — guarda quem era
    var foco = doc.activeElement && doc.activeElement.dataset ? (doc.activeElement.dataset.mobFocus || '') : '';
    clear(box);
    if (!lista.length) {
      box.appendChild(el('p', 'mob-empty', editable
        ? 'nenhum inimigo em cena — crie o primeiro acima'
        : 'nenhum inimigo em cena — o mestre ainda não colocou ninguém para vocês baterem'));
      return;
    }
    lista.forEach(function (e) {
      var row = el('div', 'mob-row' + (editable ? ' edit' : ''));

      var top = el('div', 'mob-top');
      if (editable) {
        var nome = doc.createElement('input');
        nome.type = 'text'; nome.maxLength = NOME_MAX; nome.value = e.nome;
        nome.className = 'mob-nome-inp'; nome.dataset.mobFocus = e.id + ':nome';
        nome.title = 'nome do bicho (aparece na ficha de todo mundo)';
        nome.addEventListener('change', function () { patch(e.id, 'nome', nome.value); if (after) after(); });
        top.appendChild(nome);
        tagsOf(e).forEach(function (t) { top.appendChild(t); }); // o mestre também vê o "caído" na sua lista
        var rm = el('button', 'mini-btn danger', '✕');
        rm.title = 'Tirar da cena';
        rm.addEventListener('click', function () {
          if (!global.confirm('Tirar “' + e.nome + '” da cena? Ele some da ficha de todos.')) return;
          remove(e.id);
          if (after) after();
        });
        top.appendChild(rm);
      } else {
        top.appendChild(el('b', 'mob-nome', e.nome || 'Inimigo sem nome'));
        tagsOf(e).forEach(function (t) { top.appendChild(t); });
        /* O jogador precisa saber ANTES de bater se existe um dado que pode travar o golpe dele:
           sem esta etiqueta a regra do desvio seria uma surpresa escondida no código. */
        if (e.dest > 0) top.appendChild(el('span', 'mob-tag destreza', '🌀 destreza ' + e.dest));
      }
      row.appendChild(top);

      // vida
      var lv = el('div', 'mob-line');
      lv.appendChild(el('span', 'mob-lb', 'vida'));
      lv.appendChild(bar('hp', e.hp, e.hpMax));
      // sanidade
      var ls = el('div', 'mob-line');
      ls.appendChild(el('span', 'mob-lb', 'sanidade'));
      ls.appendChild(bar('san', e.san, e.sanMax));

      if (editable) {
        [[lv, 'hp', 'vida'], [ls, 'san', 'sanidade']].forEach(function (par) {
          var line = par[0], campo = par[1], rotulo = par[2];
          var max = campo === 'hp' ? e.hpMax : e.sanMax;
          var val = campo === 'hp' ? e.hp : e.san;
          var cur = doc.createElement('input');
          cur.type = 'number'; cur.className = 'mob-num'; cur.min = '0'; cur.max = String(max); cur.step = '1'; cur.value = val;
          cur.dataset.mobFocus = e.id + ':' + campo;
          cur.title = rotulo + ' atual — marque o golpe que a mesa der';
          cur.addEventListener('change', function () { patch(e.id, campo, cur.value); if (after) after(); });
          var mx = doc.createElement('input');
          mx.type = 'number'; mx.className = 'mob-num'; mx.min = campo === 'hp' ? '1' : '0'; mx.max = '999'; mx.step = '1'; mx.value = max;
          mx.dataset.mobFocus = e.id + ':' + campo + 'Max';
          mx.title = rotulo + ' máxima dele (mexer aqui não cura: só muda o teto)';
          mx.addEventListener('change', function () { patch(e.id, campo + 'Max', mx.value); if (after) after(); });
          line.appendChild(cur);
          line.appendChild(mx);
        });
        /* 07/10 — a Destreza do bicho, no painel de quem o criou. É o ÚNICO campo novo da regra
           nova: quem bate não rola acerto (o golpe entra), então a defesa que existe é esta.
           0 = não desvia de nada; a conta aparece na etiqueta da linha dos jogadores. */
        var ld = el('div', 'mob-line');
        ld.appendChild(el('span', 'mob-lb', 'desvio'));
        var dv = doc.createElement('input');
        dv.type = 'number'; dv.className = 'mob-num'; dv.min = '0'; dv.max = String(DEST_MAX); dv.step = '1'; dv.value = e.dest || 0;
        dv.dataset.mobFocus = e.id + ':dest';
        dv.title = 'Destreza dele: ele rola d10 + este número e só desvia de um golpe se passar de ' + PAREDE + '. 0 = nunca desvia.';
        dv.addEventListener('change', function () { patch(e.id, 'dest', dv.value); if (after) after(); });
        ld.appendChild(dv);
        ld.appendChild(el('span', 'mob-desvio-txt', 'd10 + ' + (e.dest || 0) + ' · desvia com ' + PAREDE + '+'));
        row.appendChild(lv);
        row.appendChild(ls);
        row.appendChild(ld);
      } else {
        row.appendChild(lv);
        row.appendChild(ls);
        /* 07/10 — a linha do jogador deixou de ser leitura pura, porque ele mandou: "quero que
           acertem e ponto". O campo pequeno é o NÚMERO QUE A ROLAGEM DELE DEU (o dano já vem
           pronto da arma, da foice, do tiro — aqui não se rola de novo, só se marca). */
        var hit = el('div', 'mob-hit');
        var inp = doc.createElement('input');
        inp.type = 'number'; inp.className = 'mob-num'; inp.min = '0'; inp.max = '999'; inp.step = '1';
        inp.placeholder = 'dano'; inp.dataset.mobFocus = e.id + ':hit';
        inp.title = 'escreva o total que a sua rolagem de dano deu';
        var go = el('button', 'mini-btn danger', '🗡 bater');
        go.type = 'button';
        go.title = 'sem teste de acerto: o golpe entra. Ele só não entra se ' + (e.nome || 'ele') +
          ' desviar rolando d10 + Destreza ' + (e.dest || 0) + ' e passando de ' + PAREDE + '.';
        var dizer = function (txt) { MSG_HIT[e.id] = txt; if (recria) recria(); };
        var bater = function () {
          var r = machucar(e.id, inp.value);
          if (r.ok && !r.desviou) inp.value = '';
          dizer(r.msg);
        };
        inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); bater(); } });
        go.addEventListener('click', bater);
        hit.appendChild(el('span', 'mob-lb', 'golpe'));
        hit.appendChild(inp);
        hit.appendChild(go);
        row.appendChild(hit);
        row.appendChild(el('p', 'mob-hit-msg', MSG_HIT[e.id] || ''));
      }
      box.appendChild(row);
    });
    if (foco) {
      var deVolta = box.querySelector('[data-mob-focus="' + foco + '"]');
      if (deVolta) deVolta.focus();
    }
  }

  // ---------- abas: nas fichas a lista é a do JOGADOR (barras + o próprio golpe) ----------
  function bootReadOnly() {
    var box = doc.getElementById('mobList');
    if (!box) return; // é a tela do mestre (ou cache antiga): não faz nada
    var desenha = function () { renderList(box, false, null, desenha); };
    desenha();
    global.addEventListener('storage', function (e) { if (e.key === KEY) desenha(); });
    // segurança pra aba aberta enquanto outra janela mexia: redesenha ao voltar pra cena
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) desenha(); });
  }

  global.EclipseInimigos = {
    KEY: KEY, MAX: MAX, PAREDE: PAREDE, DEST_MAX: DEST_MAX,
    read: read, write: write, add: add, patch: patch, remove: remove, machucar: machucar,
    renderEditor: function (box, after) { renderList(box, true, after, null); },
    renderList: function (box) { renderList(box, false, null, null); }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bootReadOnly);
  else bootReadOnly();
})(window);
