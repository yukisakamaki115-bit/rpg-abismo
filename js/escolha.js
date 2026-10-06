/* ===== Éclipse — js/escolha.js: o salão onde o jogador escolhe quem vai jogar =====
   Por que esta tela existe: os cinco personagens já estão prontos. Então em vez de pedir
   login e senha antes de mostrar qualquer coisa, a porta de entrada agora é o próprio elenco:
   o jogador lê a vida, as habilidades e a história de cada um, clica, e o card vira
   "✔ JÁ SELECIONADO".

   A escolha é DA MESA, não do aparelho: ela mora na chave `eclipse_escolha_v1`, que não está
   na lista de chaves locais do js/store.js — ou seja, ela sincroniza sozinha. Quando um
   jogador marca o Nox no celular dele, o card do Nox aparece marcado também no notebook do
   mestre e na tela de quem abrir o portão depois. É o evento `storage` (o mesmo que o painel
   do mestre já usa) que nos avisamos: quem escreve, escreve pelo localStorage de sempre.

   `eclipse_eu_v1` (qual é o meu nome neste aparelho) fica fora da nuvem de propósito: é dado
   do teclado, não da mesa. O nome que ele digita aqui é o que aparece no selo.

   Nada aqui reescreve ficha nenhuma: só LEMOS as chaves que as fichas já salvam
   (`hp`/`hpMax`/`san`/`sanMax` têm o mesmo nome nas cinco, então uma função serve todas). */
(function (global) {
  'use strict';

  var ESCOLHA_KEY = 'eclipse_escolha_v1';
  var EU_KEY = 'eclipse_eu_v1';
  var SENHA_MESTRE = 'mestre1'; // o portão do mestre é o único que ainda pede palavra-passe

  /* Os números de vida/sanidade escritos aqui são o PADRÃO de cada ficha (o que a pessoa vê
     antes de alguém mexer). Se a chave da ficha já existir, a barra mostra o valor real que
     está salvo — e como as fichas salvam em `hp/hpMax/san/sanMax` todas, não precisa de
     tradução por personagem. */
  var PERSONAGENS = [
    {
      id: 'flora', emoji: '🌹', nome: 'Flora', classe: 'A Bailarina',
      chave: 'eclipse_flora_v1', destino: 'flor.html',
      hpNome: 'Vida', hpMax: 30, sanNome: 'Sanidade', sanMax: 100,
      habilidades: [
        '🩰 Florete — Linha de Dança: estocada no ritmo do balé',
        '🗡 Espada Leve — Corte Decidido: quando a graça não basta',
        '👟 Jogo de Pernas do Palco: distância e esquiva'
      ],
      historia: 'A bailarina do palco esquecido. É o amor da Vesper — e continua dançando mesmo com o mundo despencando em volta.'
    },
    {
      id: 'nox', emoji: '🐰', nome: 'Nox', classe: 'O Coelho de Pano',
      chave: 'eclipse_coelho_v1', destino: 'personagem2.html',
      hpNome: 'Enchimento', hpMax: 24, sanNome: 'Linha', sanMax: 100,
      habilidades: [
        '🧵 Costura de Botão: agulha, linha e botões nos olhos',
        '🚪 Passo da Porta: some por portas que não deviam existir',
        '🕯 Fio Esticado · Patada de Pano · Olho de Botão'
      ],
      historia: 'Parece pelúcia, pesa como pedra. Vive atravessando entre o mundo real e o Outro — e é ele quem costura o meio dos dois.'
    },
    {
      id: 'dante', emoji: '🔮', nome: 'Dante', classe: 'O Cartomante',
      chave: 'eclipse_santiago_v1', destino: 'personagem3.html',
      hpNome: 'Fôlego', hpMax: 22, sanNome: 'Vontade', sanMax: 100,
      habilidades: [
        '🃏 Baralho de 22 cartas, sorteio com peso (a Torre sai a 2%)',
        '✨ Buffs e cura em quem ele escolher',
        '🗡 Dano no inimigo — e 🕯 Vontade como preço da leitura'
      ],
      historia: 'Humano, cartomante e o único que empresta sorte cobrando juros. “As cartas não decidem — elas emprestam coragem.”'
    },
    {
      id: 'vesper', emoji: '🕯️', nome: 'Vesper', classe: 'A vela acesa no Crepúsculo',
      chave: 'eclipse_ficha4_v1', destino: 'ficha4.html',
      hpNome: 'Brasa', hpMax: 26, sanNome: 'Vínculo', sanMax: 100,
      tres: true, // são três dentro do mesmo corpo: a ficha mostra qual está no comando
      habilidades: [
        '🌿 Tessalha — a aura que ecoa a cura e o buff de quem ela escuta',
        '🌀 Trinstan — a Orbe arremessada: dano é o dobro da velocidade',
        '🏹 Thalles — o Arco de Luz que carrega 3 cargas e fere a ALMA (tira vida máxima)'
      ],
      historia: 'O amor da Flora, do outro lado do véu. Um corpo, três quem: a aura que escuta, a razão que conta e a luz que não perdoa.'
    },
    {
      id: 'clara', emoji: '🏮', nome: 'Clara Masorack', classe: 'A coletora de almas',
      chave: 'eclipse_ficha5_v1', destino: 'ficha5.html',
      retrato: 'img/clara.png',
      hpNome: 'Vida', hpMax: 20, sanNome: 'Sanidade', sanMax: 100,
      habilidades: [
        '🏮 Lampião com até 6 almas dentro do vidro',
        '🔥 Fogo (custa 1 alma) — mas só lá dentro do Crepúsculo',
        '🐙 Criatura Antiga (custa 2 almas) — longe do lampião, −2 em tudo'
      ],
      historia: 'Coleta almas com um lampião que não alumbra caminho, alumbra gente. Fora do Crepúsculo ela é só uma mulher com um vidro na mão.'
    }
  ];

  /* ---------- leitura/escrita ---------- */
  function bruto(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  /* O retrato que a própria pessoa (ou o mestre) subiu na ficha. É JSON `{src, zoom, panX, panY}`
     salvo em `<chave>_portrait` — o js/store.js manda ele pelo Storage quando é grande demais, e
     o que desce de lá volta a ser o mesmo JSON aqui, então esta leitura serve nos dois mundos. */
  function retratoDe(p) {
    var br = bruto(p.chave + '_portrait');
    if (!br) return '';
    var d = null;
    try { d = JSON.parse(br); } catch (e) { return /^(data:image\/|https?:\/\/)/.test(br) ? br : ''; }
    return d && typeof d.src === 'string' && /^(data:image\/|https?:\/\/)/.test(d.src) ? d.src : '';
  }
  function ler(k, padrao) {
    var s = bruto(k);
    if (!s) return padrao;
    try { var o = JSON.parse(s); return (o && typeof o === 'object') ? o : padrao; } catch (e) { return padrao; }
  }
  function escrever(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function escolhas() { return ler(ESCOLHA_KEY, {}); }
  function quemEuSou() {
    var e = ler(EU_KEY, {});
    return (e && typeof e.nome === 'string') ? e.nome.trim() : '';
  }

  /* Estado real da ficha, se ela já estiver salva nesta mesa (ou tiver chegado da nuvem).
     Sem estado salvo, mostramos o padrão da personagem — o card nunca fica em branco. */
  function vitais(p) {
    var s = ler(p.chave, null) || {};
    var hpMax = num(s.hpMax, p.hpMax), sanMax = num(s.sanMax, p.sanMax);
    return {
      hp: clamp(num(s.hp, hpMax), 0, hpMax), hpMax: hpMax,
      san: clamp(num(s.san, sanMax), 0, sanMax), sanMax: sanMax,
      pers: (p.tres && s.pers) ? String(s.pers) : '',
      nome: (s.textos && s.textos.nome) ? String(s.textos.nome).trim() : '',
      salvo: !!bruto(p.chave)
    };
  }
  function num(v, padrao) { var n = Number(v); return isFinite(n) ? n : padrao; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* A Vesper tem três personalidades e só uma no comando: o nome delas mora em CONF.personalidades,
     que é um arquivo que o portão não carrega. Então o id salvo (`thalles`) é traduzido aqui, e se
     um dia sair do lugar é só esta linha — o card nunca mostra um "thalles" cru na tela. */
  var PERS_NOME = { tessalha: '🌿 Tessalha', trinstan: '🌀 Trinstan', thalles: '🏹 Thalles' };

  function desde(ts) {
    if (!ts) return '';
    var s = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
    if (s < 45) return 'agora mesmo';
    var m = Math.floor(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    var d = Math.floor(h / 24);
    return 'há ' + d + (d === 1 ? ' dia' : ' dias');
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- o desenho ---------- */
  var hall = null, rodape = null;

  function barra(label, val, max, cls) {
    var pct = max > 0 ? clamp(Math.round((val / max) * 100), 0, 100) : 0;
    return '<div class="vital ' + cls + '">' +
      '<span class="vital-nome">' + esc(label) + '</span>' +
      '<div class="vital-barra"><i style="width:' + pct + '%"></i></div>' +
      '<b class="vital-num">' + esc(val) + ' / ' + esc(max) + '</b>' +
      '</div>';
  }

  function selo(p, meu) {
    var e = escolhas()[p.id];
    if (!e || !e.quem) return '';
    var por = esc(e.quem);
    var quando = desde(e.ts);
    return '<div class="selo' + (meu ? ' meu' : '') + '">' +
      '<span class="selo-mark">✔ JÁ SELECIONADO</span>' +
      '<span class="selo-por">por ' + por + '</span>' +
      '<span class="selo-quando" data-ts="' + esc(e.ts) + '">' + esc(quando) + '</span>' +
      (meu ? '<button type="button" class="selo-soltar" data-soltar="' + p.id + '">soltar</button>' : '') +
      '</div>';
  }

  function carta(p, i) {
    var v = vitais(p);
    var e = escolhas()[p.id];
    var eu = quemEuSou();
    var meu = !!(e && e.quem && eu && e.quem.toLowerCase() === eu.toLowerCase());
    var ocupado = !!(e && e.quem) && !meu;
    var hab = p.habilidades.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
    var acao = meu
      ? '<a class="btn-abrir" href="' + esc(p.destino) + '">Entrar na ficha ↗</a>'
      : ocupado
        ? '<button type="button" class="btn-tomar" data-tomar="' + p.id + '">Tomar para mim</button>'
        : '<button type="button" class="btn-escolher" data-escolher="' + p.id + '">Escolher ' + esc(p.nome) + '</button>';
    return '<article class="cartao' + (meu ? ' esta-meu' : (ocupado ? ' ocupado' : '')) + '" data-id="' + p.id + '"' +
      ' style="--demora:' + (i * 0.09).toFixed(2) + 's">' +
      '<div class="cartao-varnish"></div>' +
      '<header class="cartao-cab">' +
      '<span class="cartao-rosto">' +
      '<img class="cartao-retrato" alt="" />' +
      '<span class="cartao-emoji">' + p.emoji + '</span>' +
      '</span>' +
      '<div><h2 class="cartao-nome">' + esc(v.nome || p.nome) + '</h2>' +
      '<p class="cartao-classe">' + esc(p.classe) + '</p>' +
      (v.pers ? '<p class="cartao-pers">no comando agora: ' + esc(PERS_NOME[v.pers] || v.pers) + '</p>' : '') +
      '</div></header>' +
      '<div class="vitais">' +
      barra(p.hpNome, v.hp, v.hpMax, 'vida') +
      barra(p.sanNome, v.san, v.sanMax, 'san') +
      '</div>' +
      '<p class="cartao-titulo-hab">Habilidades</p>' +
      '<ul class="cartao-hab">' + hab + '</ul>' +
      '<p class="cartao-historia">' + esc(p.historia) + '</p>' +
      '<footer class="cartao-pe">' + selo(p, meu) + acao + '</footer>' +
      (ocupado ? '<p class="cartao-aviso">Este personagem já tem alguém nele. Leia, e se for engano, aperte “Tomar para mim”.</p>' : '') +
      (v.salvo ? '' : '<p class="cartao-nota">Ficha ainda não aberta nesta mesa — os números são os de estreia.</p>') +
      '</article>';
  }

  function render() {
    if (!hall) return;
    var rol = window.scrollY || 0;
    hall.innerHTML = PERSONAGENS.map(carta).join('');
    /* Retrato real por cima do emoji: primeiro o que a ficha subiu, depois a arte padrão da
       personagem (o caso da Clara, que já vem com o png que o mestre mandou). Só aceita
       `data:image/…` ou `http(s)://…`: um `javascript:` vindo de outra máquina nunca vira
       atributo de img — por isso o src é posto aqui, por DOM, e não dentro do innerHTML. */
    Array.prototype.forEach.call(hall.querySelectorAll('.cartao'), function (card) {
      var p = acha(card.getAttribute('data-id'));
      if (!p) return;
      var img = card.querySelector('.cartao-retrato');
      var src = retratoDe(p) || p.retrato || '';
      if (img && src) { img.setAttribute('src', src); card.classList.add('tem-retrato'); }
      else if (img && img.parentNode) { img.parentNode.removeChild(img); }
    });
    if (rodape) rodape.textContent = resumo();
    window.scrollTo(0, rol); // redesenhar não pode jogar a página pro topo
  }

  /* O "há 3 min" envelhece sem reconstruir a tela: trocar a página inteira a cada 30
     segundos faria o retrato piscar e o hover de quem está lendo sumir. */
  function refrescarTempos() {
    if (!hall) return;
    Array.prototype.forEach.call(hall.querySelectorAll('.selo-quando'), function (el) {
      var t = el.getAttribute('data-ts');
      el.textContent = desde(t ? Number(t) : 0);
    });
    if (rodape) rodape.textContent = resumo();
  }

  function resumo() {
    var e = escolhas(), tomados = 0;
    PERSONAGENS.forEach(function (p) { if (e[p.id] && e[p.id].quem) tomados++; });
    if (!tomados) return 'Ninguém escolheu ainda — ' + PERSONAGENS.length + ' personagens na prateleira.';
    return tomados + ' de ' + PERSONAGENS.length + ' já têm alguém jogando.';
  }

  /* ---------- as ações ---------- */
  function escolher(id) {
    var eu = quemEuSou();
    if (!eu) { pedirNome(id); return; }
    var t = escolhas();
    t[id] = { quem: eu, ts: Date.now() };
    escrever(ESCOLHA_KEY, t);
    render();
    var card = hall.querySelector('.cartao[data-id="' + id + '"]');
    if (card && card.scrollIntoView) { try { card.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  function soltar(id) {
    var t = escolhas();
    if (t[id]) { delete t[id]; escrever(ESCOLHA_KEY, t); render(); }
  }

  function tomar(id) {
    var p = acha(id), eu = quemEuSou(), atual = escolhas()[id];
    if (!p) return;
    if (!eu) { pedirNome(id); return; }
    var aviso = (atual && atual.quem) ? ('“' + p.nome + '” está marcado como de ' + atual.quem + '.\n\nTomar para você?') : '';
    if (aviso && !global.confirm(aviso)) return;
    escolher(id);
  }

  function acha(id) {
    for (var i = 0; i < PERSONAGENS.length; i++) { if (PERSONAGENS[i].id === id) return PERSONAGENS[i]; }
    return null;
  }

  function pedirNome(depoisId) {
    var inp = document.getElementById('euNome');
    if (!inp) return;
    inp.focus();
    var caixa = inp.closest('.eu');
    if (caixa) { caixa.classList.remove('pede-nome'); void caixa.offsetWidth; caixa.classList.add('pede-nome'); }
    if (depoisId) pendente = depoisId;
    avisa('Escreva o seu nome primeiro — é ele que aparece no selo “JÁ SELECIONADO”.');
  }
  var pendente = null;

  var msg = null;
  function avisa(txt) {
    if (!msg) return;
    msg.textContent = txt;
    msg.hidden = false;
    clearTimeout(avisa._t);
    avisa._t = setTimeout(function () { msg.hidden = true; }, 5200);
  }

  /* ---------- o portão do mestre (a única porta que ainda tem palavra-passe) ----------
     Não é segurança de verdade: um jogador curioso com o link certo abre qualquer ficha
     direto, sempre pôde. O que isto segura é o clique acidental no painel que mexe na mesa
     inteira. A proteção real da mesa passa a ser a conta do Firebase + as regras do banco. */
  function entrarMestre() {
    var inp = document.getElementById('mestreSenha');
    if (!inp) return;
    var log = ler('eclipse_login', null);
    if (log && log.user === 'mestre') { global.location.href = 'mestre.html'; return; }
    if (String(inp.value) === SENHA_MESTRE) {
      escrever('eclipse_login', { user: 'mestre', ts: Date.now() });
      global.location.href = 'mestre.html';
    } else {
      avisa('Palavra-passe do mestre não é esta.');
      inp.value = '';
    }
  }

  /* ---------- o chip do sync (nuvem / local / pendências) ---------- */
  function ligarStatus() {
    var chip = document.getElementById('syncChip');
    var store = global.ECLIPSE_STORE;
    if (!chip) return;
    if (!store) { chip.textContent = '⚙ sync não carregou'; chip.className = 'syncChip off'; return; }
    store.onStatus(function (s) {
      if (s.modo === 'nuvem') {
        chip.textContent = '☁ nuvem · ' + s.mesa + (s.pendentes ? ' · ' + s.pendentes + ' subindo' : '') + (s.naVem ? ' · ' + s.naVem + ' chaves no banco' : '');
        chip.className = 'syncChip on';
      } else if (s.modo === 'sem-conta') {
        chip.textContent = '☁ nuvem pronta, falta entrar com e-mail e senha';
        chip.className = 'syncChip mid';
      } else {
        chip.textContent = '⛺ modo local (sem nuvem)';
        chip.className = 'syncChip off';
      }
      if (s.erro) { chip.className = 'syncChip bad'; chip.textContent = '⚠ ' + s.erro; }
    });
  }

  /* ---------- ligações ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    hall = document.getElementById('hall');
    rodape = document.getElementById('salaoResumo');
    msg = document.getElementById('salaoMsg');
    if (!hall) return;

    var inp = document.getElementById('euNome');
    if (inp) {
      inp.value = quemEuSou();
      inp.addEventListener('input', function () {
        escrever(EU_KEY, { nome: inp.value.trim() });
        /* Ele apertou um card antes de se apresentar: o nome que acabou de sair paga a
           escolha na hora. Nos outros casos a tela só é re-desenhada no `change` —
           re-escrever os cinco cards a cada tecla faria o retrato piscar durante a digitação. */
        if (pendente && inp.value.trim()) { var id = pendente; pendente = null; escolher(id); }
      });
      inp.addEventListener('change', function () { render(); });
    }

    hall.addEventListener('click', function (ev) {
      var t = ev.target;
      function up(sel) { return t.closest ? t.closest(sel) : null; }
      var bEscolher = up('[data-escolher]'), bTomar = up('[data-tomar]'), bSoltar = up('[data-soltar]');
      if (bEscolher) { escolher(bEscolher.getAttribute('data-escolher')); return; }
      if (bTomar) { tomar(bTomar.getAttribute('data-tomar')); return; }
      if (bSoltar) { ev.preventDefault(); soltar(bSoltar.getAttribute('data-soltar')); return; }
      var abrir = up('.btn-abrir');
      if (abrir) return; // navega sozinho
      var card = up('.cartao');
      if (card) {
        var id = card.getAttribute('data-id');
        var e = escolhas()[id];
        var eu = quemEuSou();
        var meu = !!(e && e.quem && eu && e.quem.toLowerCase() === eu.toLowerCase());
        if (meu) global.location.href = acha(id).destino;
        else if (e && e.quem) avisa('“' + acha(id).nome + '” já é de ' + e.quem + '. Para trocar, aperte “Tomar para mim”.');
        else escolher(id);
      }
    });

    var mt = document.getElementById('mestreBtn');
    if (mt) mt.addEventListener('click', entrarMestre);
    var ms = document.getElementById('mestreSenha');
    if (ms) ms.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); entrarMestre(); } });

    var ano = document.getElementById('salaoAno');
    if (ano) ano.textContent = String(new Date().getFullYear());
    render();
    ligarStatus();
    setInterval(refrescarTempos, 30000); // só as etiquetas de tempo envelhecem; a tela não é re-desenhada

    /* A escolha chegou de outra aba OU desceu do Firestore (o js/store.js re-dispara este
       mesmo evento quando a nuvem escreve no cache). Nos dois casos: redesenhar. */
    global.addEventListener('storage', function (e) {
      if (!e || e.key === ESCOLHA_KEY || e.key === null) render();
    });

    /* Card de quem acabou de ser escolhido entra primeiro na vista em telas estreitas. */
    var eu = quemEuSou();
    if (!eu) { var d = document.getElementById('euNome'); if (d) d.placeholder = 'ex.: Thales, Flora, mestre…'; }
  });
})(window);
