/* ===== Inimigos em cena — o bestiário que o MESTRE cria e os JOGADORES veem =====
   Uma chave só (eclipse_inimigos_v1) compartilhada entre as 4 páginas.
   Quem muda é só o painel do mestre; nas fichas isto é leitura pura, desenhada em #mobList.
   O mestre chama EclipseInimigos.renderEditor() no bloco dele (#mobEditList).
   Nada aqui encosta no estado das fichas (vida/sanidade/marcas de cada personagem). */
(function (global) {
  'use strict';

  var KEY = 'eclipse_inimigos_v1';
  var MAX = 6;        // mais que isso estoura a tela do mestre e a aba dos jogadores
  var NOME_MAX = 30;
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
      san: clampInt(e.san, 0, sanMax)
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
  function add(nome, hp, san) {
    var l = read();
    if (l.length >= MAX) { alert('Já tem ' + MAX + ' inimigos em cena — tire um antes de criar outro.'); return false; }
    nome = String(nome || '').trim().slice(0, NOME_MAX) || ('Inimigo ' + (l.length + 1));
    var hpMax = clampInt(hp, 1, 999);
    var sanMax = clampInt(san, 0, 999);
    l.push({ id: Date.now(), nome: nome, hpMax: hpMax, hp: hpMax, sanMax: sanMax, san: sanMax });
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
      if (campo === 'sanMax') { e.sanMax = clampInt(valor, 0, 999); if (e.san > e.sanMax) e.san = e.sanMax; }
    });
    if (!achou) return false;
    return write(l);
  }
  function remove(id) { return write(read().filter(function (e) { return e.id !== id; })); }

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

  function renderList(box, editable, after) {
    if (!box) return;
    var lista = read();
    // recriar a linha tiraria o foco de quem está digitando (ou clicando nas setinhas) — guarda quem era
    var foco = doc.activeElement && doc.activeElement.dataset ? (doc.activeElement.dataset.mobFocus || '') : '';
    clear(box);
    if (!lista.length) {
      box.appendChild(el('p', 'mob-empty', editable
        ? 'nenhum inimigo em cena — crie o primeiro acima'
        : 'nenhum inimigo em cena — o mestre ainda não colocou ninguém'));
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
      }
      row.appendChild(lv);
      row.appendChild(ls);
      box.appendChild(row);
    });
    if (foco) {
      var deVolta = box.querySelector('[data-mob-focus="' + foco + '"]');
      if (deVolta) deVolta.focus();
    }
  }

  // ---------- abas: nas fichas isto é só leitura ----------
  function bootReadOnly() {
    var box = doc.getElementById('mobList');
    if (!box) return; // é a tela do mestre (ou cache antiga): não faz nada
    var desenha = function () { renderList(box, false, null); };
    desenha();
    global.addEventListener('storage', function (e) { if (e.key === KEY) desenha(); });
    // segurança pra aba aberta enquanto outra janela mexia: redesenha ao voltar pra cena
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) desenha(); });
  }

  global.EclipseInimigos = {
    KEY: KEY, MAX: MAX,
    read: read, write: write, add: add, patch: patch, remove: remove,
    renderEditor: function (box, after) { renderList(box, true, after); },
    renderList: function (box) { renderList(box, false, null); }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bootReadOnly);
  else bootReadOnly();
})(window);
