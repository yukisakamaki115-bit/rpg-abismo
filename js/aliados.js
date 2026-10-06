/* ===== Éclipse — js/aliados.js: a mini-aba flutuante "quem está na mesa" =====
   Ele pediu em 06/10, com duas funções que parecem uma só mas são separáveis:

   1) O BATIMENTO — esta aba avisa o banco (e as abas vizinhas, pelo espelho local do
      js/store.js) que ESTE aparelho está com ESTA ficha aberta agora. É isso que acende a
      bolinha verde no card do painel do mestre. Sem batimento, ninguém aparece para ninguém.
   2) O QUADRO — a mini-aba no canto direito que lista quem está conectado com a ficha aberta,
      mostrando só o que ele pediu: nome, Vida e Sanidade.

   Por que é um arquivo só, carregado por toda página: a mesma pergunta ("tem alguém aí?") é
   feita de cinco fichas, do salão e do painel do mestre, e a resposta tem que ser a mesma
   lista em todos os lados. Nada aqui depende de outro arquivo além do js/store.js — e se o
   vestido não estiver na página (cache velha), a mini-aba nem aparece: não há o que anunciar.

   De onde vêm os números: da FICHA sincronizada, não do bilhete de presença. Toda chave de
   ficha é da mesa, então este navegador já tem cópia do que o outro lado salvou — e o vestido
   re-dispara o `storage` quando aquilo desce do banco. O bilhete de presença leva os mesmos
   números só como reserva, para o caso de a ficha ainda não ter chegado nesta máquina. */
(function (global) {
  'use strict';

  /* A mesa, na boca dela: arquivo → chave → quem é → como se chamam as duas barras.
     Os nomes vêm das próprias fichas ("Enchimento"/"Linha" é o Nox, "Brasa"/"Vínculo" é a
     Tessalha), no português curto que cabe na mini-aba: é a MESMA etiqueta que o painel do mestre
     usa nos cards, senão a pessoa olha para um número e não sabe o que é. */
  var MESA = [
    { arq: 'flor.html', chave: 'eclipse_flora_v1', nome: 'Flora', hp: 'Vida', san: 'Sanidade' },
    { arq: 'personagem2.html', chave: 'eclipse_coelho_v1', nome: 'Nox', hp: 'Enchimento', san: 'Linha' },
    { arq: 'personagem3.html', chave: 'eclipse_santiago_v1', nome: 'Dante', hp: 'Fôlego', san: 'Vontade' },
    { arq: 'ficha4.html', chave: 'eclipse_ficha4_v1', nome: 'Tessalha', hp: 'Brasa', san: 'Vínculo' },
    { arq: 'ficha5.html', chave: 'eclipse_ficha5_v1', nome: 'Clara', hp: 'Vida', san: 'Sanidade' }
  ];
  var LEMBRE_KEY = 'eclipse_aliados_v1'; // aberto/fechado é mania deste aparelho: nunca sobe (SO_LOCAIS)

  function arquivo() {
    try { return String(location.pathname).split('/').pop().toLowerCase(); } catch (e) { return ''; }
  }
  var AQUI = null, PAGINA = arquivo();
  MESA.forEach(function (f) { if (f.arq === PAGINA) AQUI = f; });

  var E_MESTRE = PAGINA.indexOf('mestre') === 0;
  var ROSTO = AQUI ? AQUI.nome : (E_MESTRE ? 'painel do mestre' : 'salão');

  function num(v, padrao) { var n = Number(v); return isFinite(n) ? n : padrao; }
  function limpa(t) { return String(t == null ? '' : t).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function estado(chave) {
    if (!chave) return null;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return null;
    var nome = limpa(s.nome) || limpa(s.textos && s.textos.nome);
    return {
      hp: num(s.hp, 0), hpMax: num(s.hpMax, 0), san: num(s.san, 0), sanMax: num(s.sanMax, 0),
      nome: nome.slice(0, 24)
    };
  }
  function cracha() {
    var e = null;
    try { e = JSON.parse(localStorage.getItem('eclipse_eu_v1') || 'null'); } catch (x) { e = null; }
    return (e && typeof e.nome === 'string') ? e.nome.trim().slice(0, 40) : '';
  }

  /* ---------- 1) o batimento ---------- */
  function meta() {
    var e = AQUI ? estado(AQUI.chave) : null;
    var m = { quem: cracha(), ficha: ROSTO, chave: AQUI ? AQUI.chave : '' };
    if (e) { m.hp = e.hp; m.hpMax = e.hpMax; m.san = e.san; m.sanMax = e.sanMax; }
    return m;
  }

  /* ---------- 2) o quadro ---------- */
  var CAIXA = null, LISTA = null, CHAVE = null, adiado = null;

  function desde(ts) {
    var s = Math.max(0, Math.floor((Date.now() - (Number(ts) || 0)) / 1000));
    if (s < 45) return 'agora';
    var m = Math.floor(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    return 'há ' + Math.floor(m / 60) + ' h';
  }

  function barra(rotulo, val, max, cls) {
    var li = document.createElement('span');
    li.className = 'ali-vit ' + cls;
    var pct = max > 0 ? Math.max(0, Math.min(100, Math.round((val / max) * 100))) : 0;
    var trilho = document.createElement('span');
    trilho.className = 'trilho';
    var fill = document.createElement('span');
    fill.style.width = pct + '%';
    trilho.appendChild(fill);
    var txt = document.createElement('b');
    txt.textContent = rotulo + ' ' + val + '/' + max;
    li.appendChild(trilho);
    li.appendChild(txt);
    return li;
  }

  function daMesa(chave) {
    var a = null;
    MESA.forEach(function (f) { if (f.chave === chave) a = f; });
    return a;
  }

  function linha(c, souEu) {
    var li = document.createElement('li');
    li.className = 'ali-row' + (souEu ? ' eu' : '');
    var e = c.chave ? estado(c.chave) : null;
    var f = daMesa(c.chave);
    /* A ordem do nome é esta, e o meio importa: o nome que a pessoa digitou na ficha, senão o
       nome da mesa (Nox, Clara...), senão onde ela está. Sem o meio, um colega cuja ficha ainda
       não tem título editado aparecia na lista escrito `personagem2.html` — que não é nome de
       aliado nenhum, é nome de arquivo. */
    var nome = (e && e.nome) || (f && f.nome) || limpa(c.ficha) || 'alguém';
    var dot = document.createElement('span');
    dot.className = 'ali-ponto' + (c.chave ? ' on' : ' mid');
    dot.title = c.chave ? 'está com a ficha aberta agora' : 'no site, sem ficha aberta';
    li.appendChild(dot);
    var b = document.createElement('b');
    b.className = 'ali-nome';
    b.textContent = souEu ? (nome + ' (você)') : nome;
    li.appendChild(b);
    if (c.chave) {
      var hp = num(e ? e.hp : c.hp, 0), hpMax = num(e ? e.hpMax : c.hpMax, 0);
      var san = num(e ? e.san : c.san, 0), sanMax = num(e ? e.sanMax : c.sanMax, 0);
      var rotuloHp = f ? f.hp : 'Vida', rotuloSan = f ? f.san : 'Sanidade';
      if (hpMax) li.appendChild(barra(rotuloHp, hp, hpMax, 'hp'));
      if (sanMax) li.appendChild(barra(rotuloSan, san, sanMax, 'san'));
    } else {
      var onde = limpa(c.ficha);
      if (onde && onde !== nome) {
        var sem = document.createElement('i');
        sem.className = 'ali-onde';
        sem.textContent = onde;
        li.appendChild(sem);
      }
    }
    li.title = (c.quem ? c.quem + ' · ' : '') + 'vivo ' + desde(c.ts);
    return li;
  }

  function desenhar() {
    if (!LISTA || !global.ECLIPSE_STORE) return;
    var st = global.ECLIPSE_STORE;
    var colegas = [];
    try { colegas = st.colegas() || []; } catch (e) { colegas = []; }
    var meu = meta();
    while (LISTA.firstChild) LISTA.removeChild(LISTA.firstChild);
    var naFicha = 0;
    colegas.forEach(function (c) { if (c.chave) naFicha++; });
    if (meu.chave) naFicha++;
    var total = colegas.length + 1; // eu sempre estou aqui: sou o único que tem certeza de mim

    /* Eu primeiro, marcado: a pergunta que a mesa faz é "quem mais está aí", mas saber o que
       eu estou ocupando evita dois jogadores na mesma ficha sem ninguém perceber. */
    LISTA.appendChild(linha(meu, true));
    colegas.forEach(function (c) { LISTA.appendChild(linha(c, false)); });
    if (CHAVE) {
      CHAVE.textContent = '👥 ' + total;
      CHAVE.title = total + ' no site · ' + naFicha + ' com ficha aberta';
    }
  }

  function lembrar(aberto) {
    try { localStorage.setItem(LEMBRE_KEY, JSON.stringify({ aberto: !!aberto })); } catch (e) {}
  }
  function lembrado() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(LEMBRE_KEY) || 'null'); } catch (e) { o = null; }
    return !!(o && o.aberto);
  }

  function css() {
    if (document.getElementById('aliEstilo')) return;
    var s = document.createElement('style');
    s.id = 'aliEstilo';
    s.textContent = [
      '.ali-tab{position:fixed;right:18px;bottom:64px;z-index:65;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:var(--serif-title,Georgia,serif)}',
      '.ali-chave{cursor:pointer;border-radius:999px;padding:7px 13px;font-family:inherit;font-size:12px;letter-spacing:1px;',
      '  background:rgba(255,255,255,.94);color:#4a3f28;border:1px solid var(--gold,#c9a24b);box-shadow:0 8px 22px rgba(0,0,0,.18);transition:.2s}',
      '.ali-chave:hover{background:var(--gold-soft,#e6cf8b);transform:translateY(-2px)}',
      '.ali-caixa{width:246px;max-width:72vw;max-height:min(48vh,360px);overflow:auto;padding:10px 12px;',
      '  background:rgba(255,255,255,.96);border:1px solid var(--gold,#c9a24b);border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.22)}',
      '.ali-tab.feixada .ali-caixa{display:none}',
      '.ali-titulo{margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8b8677}',
      '.ali-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
      '.ali-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.5px;color:#40331a}',
      '.ali-row.eu .ali-nome{color:var(--gold-deep,#8a6d1f)}',
      '.ali-nome{font-size:13.5px;letter-spacing:.3px}',
      '.ali-ponto{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#bdb7a6;box-shadow:0 0 0 3px rgba(0,0,0,.05)}',
      '.ali-ponto.on{background:#25a24a;animation:aliViva 2.6s ease-in-out infinite}',
      '.ali-ponto.mid{background:#c9a24b}',
      '@keyframes aliViva{50%{opacity:.45}}',
      '.ali-onde{font-style:italic;color:#a49e8f;font-size:11.5px}',
      '.ali-vit{position:relative;flex:1 1 100%;display:flex;align-items:center;gap:6px;padding-left:2px}',
      '.ali-vit .trilho{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:7px;',
      '  border-radius:999px;background:rgba(0,0,0,.08);overflow:hidden}',
      '.ali-vit .trilho span{display:block;height:100%;border-radius:999px;background:#8c8f8c}',
      '.ali-vit.hp .trilho span{background:linear-gradient(90deg,#c2554f,#e08a6a)}',
      '.ali-vit.san .trilho span{background:linear-gradient(90deg,#4f7fc2,#7fb3c9)}',
      '.ali-vit b{position:relative;margin-left:auto;font-size:11.5px;color:#4a3f28;background:rgba(255,255,255,.7);padding:0 5px;border-radius:6px}',
      '.ali-rodape{margin:8px 0 0;font-size:11px;color:#8b8677}',
      'html[data-theme="dark"] .ali-chave{background:rgba(38,36,44,.94);color:var(--gold-soft,#e4cf96);border-color:#57471f}',
      'html[data-theme="dark"] .ali-caixa{background:rgba(38,36,44,.96);border-color:#57471f}',
      'html[data-theme="dark"] .ali-row,html[data-theme="dark"] .ali-vit b{color:#ddd6c8}',
      'html[data-theme="dark"] .ali-vit .trilho{background:rgba(255,255,255,.1)}',
      'html[data-theme="dark"] .ali-vit b{background:rgba(20,19,25,.6)}',
      'html[data-theme="dark"] .ali-row.eu .ali-nome{color:var(--gold-soft,#e4cf96)}',
      '@media (max-width:560px){.ali-tab{bottom:60px;right:12px}.ali-caixa{max-height:40vh}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function montar() {
    css();
    var tab = document.createElement('div');
    tab.className = 'ali-tab' + (lembrado() ? '' : ' feixada');
    tab.id = 'aliTab';

    CAIXA = document.createElement('div');
    CAIXA.className = 'ali-caixa';
    var titulo = document.createElement('p');
    titulo.className = 'ali-titulo';
    titulo.textContent = 'Na mesa agora';
    LISTA = document.createElement('ul');
    LISTA.className = 'ali-lista';
    var rodape = document.createElement('p');
    rodape.className = 'ali-rodape';
    rodape.id = 'aliRodape';
    CAIXA.appendChild(titulo);
    CAIXA.appendChild(LISTA);
    CAIXA.appendChild(rodape);

    CHAVE = document.createElement('button');
    CHAVE.type = 'button';
    CHAVE.className = 'ali-chave';
    CHAVE.textContent = '👥 ·';
    CHAVE.addEventListener('click', function () {
      var fechado = tab.classList.toggle('feixada');
      lembrar(!fechado);
      if (!fechado) desenhar();
    });

    tab.appendChild(CAIXA);
    tab.appendChild(CHAVE);
    document.body.appendChild(tab);
  }

  function ligar() {
    var st = global.ECLIPSE_STORE;
    if (!st || !st.pulsar || !document.body) return;
    st.onPulso(meta);          // o batimento de 15 s leva o meta fresco, não o da abertura da página
    st.pulsar(meta());         // primeira presença imediata: a bolinha acende sem esperar o timer
    if (st.onPresenca) st.onPresenca(function () { desenhar(); });
    /* A ficha do outro desceu do banco → os números da lista mudam na hora. Adiado de propósito:
       a rajada da carga inicial tem dezenas de chaves, e redesenhar a cada uma é lag puro. */
    global.addEventListener('storage', function (e) {
      if (!e || !e.key || e.key.indexOf('eclipse_') !== 0) return;
      if (adiado) return;
      adiado = setTimeout(function () { adiado = null; desenhar(); }, 400);
    });
    /* O chip do sync diz se a lista vem do banco ou só deste navegador — é a resposta honesta
       para "as fichas estão atualizando sozinhas?". */
    if (st.onStatus) {
      st.onStatus(function (s) {
        var r = document.getElementById('aliRodape');
        if (!r) return;
        r.textContent = s && s.erro ? '⚠ ' + s.erro
          : (s && s.modo === 'nuvem' ? '☁ ao vivo pela mesa · ' + (s.mesa || '')
            : '⛺ só neste navegador — ninguém mais vê você');
      });
    }
    desenhar();
  }

  function iniciar() {
    /* Sem o vestido não há batimento nem colegas: a mini-aba mentiria. Melhor nada. */
    if (!global.ECLIPSE_STORE || !global.ECLIPSE_STORE.pulsar) return;
    montar();
    ligar();
    global.__ALIADOS_OK = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
