/* ===== Éclipse — js/escolha.js: o salão onde o jogador escolhe quem vai jogar =====
   Por que esta tela existe: os cinco personagens já estão prontos. Então em vez de pedir
   login e senha antes de mostrar qualquer coisa, a porta de entrada agora é o próprio elenco:
   o jogador vê NOME e IDADE de cada um, passa o mouse (ou toca no "detalhes") e lê vida,
   habilidades e história. Ao clicar, o card vira "✔ JÁ SELECIONADO".

   A escolha é DA MESA, não do aparelho: ela mora na chave `eclipse_escolha_v1`, que não está
   na lista de chaves locais do js/store.js — ou seja, ela sincroniza sozinha. Quando um
   jogador marca o Nox no celular dele, o card do Nox aparece marcado também no notebook do
   mestre e na tela de quem abrir o portão depois. É o evento `storage` (o mesmo que o painel
   do mestre já usa) que nos avisamos: quem escreve, escreve pelo localStorage de sempre.

   `eclipse_eu_v1` (qual é o meu nome neste aparelho) fica fora da nuvem de propósito: é dado
   do teclado, não da mesa. O nome que ele digita aqui é o que aparece no selo.

   Nada aqui reescreve ficha nenhuma: só LEMOS as chaves que as fichas já salvam
   (`hp`/`hpMax`/`san`/`sanMax` têm o mesmo nome nas cinco, então uma função serve todas).

   ─── A REGRA DE OURO DA VERSÃO NOVA (06/10): esta tela NUNCA redesenha o salão inteiro ───
   Na primeira versão, cada evento `storage` chamava `render()`, e o vestido do js/store.js
   dispara UM desses eventos por chave que desce do banco. Com cinco fichas, cinco retratos
   em base64 e os logs da mesa na conta, abrir o portão virava dezenas de
   `innerHTML = <5 cards>` em sequência: o navegador decodificava retrato grande de novo a
   cada vez, e a página travava. Agora: `render()` roda UMA vez (no boot), e tudo o que
   envelhece depois — selo, vida, "há 3 min", quem está no corpo — é corrigido NO LUGAR por
   `atualizar()`, com os avisos da rede ajuntados num debounce de 400 ms.
   tocando só o texto que mudou. Os retratos não são tocados de novo. */
(function (global) {
  'use strict';

  var ESCOLHA_KEY = 'eclipse_escolha_v1';
  var EU_KEY = 'eclipse_eu_v1';
  var SENHA_MESTRE = 'mestre1'; // o portão do mestre é o único que ainda pede palavra-passe

  /* Os números de vida/sanidade escritos aqui são o PADRÃO de cada ficha (o que a pessoa vê
     antes de alguém mexer). Se a chave da ficha já existir, a barra mostra o valor real que
     está salvo — e como as fichas salvam em `hp/hpMax/san/sanMax` todas, não precisa de
     tradução por personagem.
     `idade`: a Clara são os 17 da ficha dela (mestre escreveu). Os outros quatro não tinham
     idade escrita em lugar nenhum, então estes aqui são escolha nossa — troque o número na
     tabela e o card obedece. */
  var PERSONAGENS = [
    {
      id: 'flora', emoji: '🌹', nome: 'Flora', classe: 'A Bailarina', idade: 24,
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
      id: 'nox', emoji: '🐰', nome: 'Nox', classe: 'O Coelho de Pano', idade: 19,
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
      id: 'dante', emoji: '🔮', nome: 'Dante', classe: 'O Cartomante', idade: 32,
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
      id: 'vesper', emoji: '🕯️', nome: 'Vesper', classe: 'A vela acesa no Crepúsculo', idade: 23,
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
      id: 'clara', emoji: '🏮', nome: 'Clara Masorack', classe: 'A coletora de almas', idade: 17,
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
     salvo em `<chave>_portrait` — o js/store.js manda foto grande para o nó `retratos` e deixa só
     um bilhete no `chaves`, mas o que desce de lá volta a ser o mesmo JSON aqui, então esta
     leitura serve nos dois mundos. */
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

  /* ---------- o desenho ----------
     O card aberto é pequeno de propósito: rosto, nome, idade, ofício e a vida. O resto
     (habilidades, história, recado de "já tem alguém nele") vive dentro de `.cartao-mais`,
     que o CSS abre no hover/focus do mouse e que o toque abre pelo botão "detalhes".
     Os dois buracos que envelhecem (selo e ações) têm classe própria para o `atualizar()`
     trocar sem encostar no retrato. */
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

  function acao(p, meu, ocupado) {
    if (meu) return '<a class="btn-abrir" href="' + esc(p.destino) + '">Entrar na ficha ↗</a>';
    if (ocupado) return '<button type="button" class="btn-tomar" data-tomar="' + p.id + '">Tomar para mim</button>';
    return '<button type="button" class="btn-escolher" data-escolher="' + p.id + '">Escolher ' + esc(p.nome) + '</button>';
  }

  /* O que só aparece no hover/toque. */
  function detalhes(p, ocupado, salvo) {
    var hab = p.habilidades.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
    return '<p class="cartao-titulo-hab">Habilidades</p>' +
      '<ul class="cartao-hab">' + hab + '</ul>' +
      '<p class="cartao-historia">' + esc(p.historia) + '</p>' +
      (ocupado ? '<p class="cartao-aviso">Este personagem já tem alguém nele. Leia, e se for engano, aperte “Tomar para mim”.</p>' : '') +
      (salvo ? '' : '<p class="cartao-nota">Ficha ainda não aberta nesta mesa — os números são os de estreia.</p>');
  }

  function carta(p, i) {
    var v = vitais(p);
    var e = escolhas()[p.id];
    var eu = quemEuSou();
    var meu = !!(e && e.quem && eu && e.quem.toLowerCase() === eu.toLowerCase());
    var ocupado = !!(e && e.quem) && !meu;
    return '<article class="cartao' + (meu ? ' esta-meu' : (ocupado ? ' ocupado' : '')) + '" data-id="' + p.id + '"' +
      ' data-sig="' + esc((meu ? 'm' : (ocupado ? 'o' : '-')) + '|' + (e && e.quem ? e.quem : '') +
        '|' + (e && e.ts ? e.ts : 0) + '|' + (v.salvo ? 's' : '-')) + '"' +
      ' style="--demora:' + (i * 0.09).toFixed(2) + 's">' +
      '<div class="cartao-varnish"></div>' +
      '<header class="cartao-cab">' +
      '<span class="cartao-rosto">' +
      '<img class="cartao-retrato" alt="" decoding="async" loading="lazy" />' +
      '<span class="cartao-emoji">' + p.emoji + '</span>' +
      '</span>' +
      '<div class="cartao-who">' +
      '<h2 class="cartao-nome">' + esc(v.nome || p.nome) + '</h2>' +
      '<p class="cartao-idade"><b>Idade</b> ' + esc(p.idade) + '</p>' +
      '<p class="cartao-classe">' + esc(p.classe) + '</p>' +
      (v.pers ? '<p class="cartao-pers">no comando: ' + esc(PERS_NOME[v.pers] || v.pers) + '</p>' : '') +
      '</div>' +
      '<button type="button" class="cartao-mais-btn" aria-expanded="false" title="ver habilidades e história">detalhes</button>' +
      '</header>' +
      '<div class="vitais">' +
      barra(p.hpNome, v.hp, v.hpMax, 'vida') +
      barra(p.sanNome, v.san, v.sanMax, 'san') +
      '</div>' +
      '<div class="cartao-furo">' + selo(p, meu) + acao(p, meu, ocupado) + '</div>' +
      '<div class="cartao-mais">' + detalhes(p, ocupado, v.salvo) + '</div>' +
      '</article>';
  }

  /* Reconstrói SÓ o buraco do selo + botão de um card. É a única parte do card que pode
     trocar de markup (escolher → abrir / tomar), e mesmo assim é um pedaço de ~10 linhas,
     não cinco cards com retrato dentro.
     A assinatura (`data-sig`) guarda quem está no card e desde quando: enquanto ela for a
     mesma, nada é re-escrito. Sem isso, cada evento que desce do banco recriaria o selo e o
     carimbo "✔ JÁ SELECIONADO" ficaria sendo batido de novo a cada 400 ms na cara do jogador. */
  function repintaFuro(card, p, já) {
    var e = escolhas()[p.id];
    var eu = quemEuSou();
    var meu = !!(e && e.quem && eu && e.quem.toLowerCase() === eu.toLowerCase());
    var ocupado = !!(e && e.quem) && !meu;
    var v = já || vitais(p);
    var sig = (meu ? 'm' : (ocupado ? 'o' : '-')) + '|' + (e && e.quem ? e.quem : '') +
      '|' + (e && e.ts ? e.ts : 0) + '|' + (v.salvo ? 's' : '-');
    card.classList.toggle('esta-meu', meu);
    card.classList.toggle('ocupado', ocupado);
    if (card.getAttribute('data-sig') === sig) return;
    card.setAttribute('data-sig', sig);
    var furo = card.querySelector('.cartao-furo');
    if (furo) furo.innerHTML = selo(p, meu) + acao(p, meu, ocupado);
    var mais = card.querySelector('.cartao-mais');
    if (mais) mais.innerHTML = detalhes(p, ocupado, v.salvo);
  }

  /* Correção no lugar: vida, nome no cabeçalho, quem está no corpo da Vesper, selo.
     Nada de innerHTML no card inteiro — é aqui que o lag de abrir a tela morava. */
  function atualizar() {
    if (!hall) return;
    PERSONAGENS.forEach(function (p) {
      var card = hall.querySelector('.cartao[data-id="' + p.id + '"]');
      if (!card) return;
      var v = vitais(p);
      põeBarra(card, 'vida', v.hp, v.hpMax);
      põeBarra(card, 'san', v.san, v.sanMax);
      var nome = card.querySelector('.cartao-nome');
      if (nome && v.nome && nome.textContent !== v.nome) nome.textContent = v.nome;
      var pers = card.querySelector('.cartao-pers');
      var texto = v.pers ? ('no comando: ' + (PERS_NOME[v.pers] || v.pers)) : '';
      if (texto && !pers) {
        pers = document.createElement('p');
        pers.className = 'cartao-pers';
        var who = card.querySelector('.cartao-who');
        if (who) who.appendChild(pers); else pers = null;
      }
      if (pers) { if (texto) pers.textContent = texto; else if (pers.parentNode) pers.parentNode.removeChild(pers); }
      repintaFuro(card, p, v);
    });
    refrescarTempos();
    if (rodape) rodape.textContent = resumo();
  }

  function põeBarra(card, cls, val, max) {
    var el = card.querySelector('.vital.' + cls);
    if (!el) return;
    var fill = el.querySelector('.vital-barra i');
    var alg = el.querySelector('.vital-num');
    var pct = max > 0 ? clamp(Math.round((val / max) * 100), 0, 100) : 0;
    if (fill && fill.style.width !== pct + '%') fill.style.width = pct + '%';
    var t = val + ' / ' + max;
    if (alg && alg.textContent !== t) alg.textContent = t;
  }

  /* Uma vez só: desenha o salão e pendura os retratos. É a única vez que a tela inteira é
     escrita, e é também a única vez que um `src` de imagem é tocado. */
  function render() {
    if (!hall) return;
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
  }

  /* O "há 3 min" envelhece sem reconstruir a tela: trocar a página inteira a cada 30
     segundos faria o retrato piscar e o hover de quem está lendo sumir. */
  function refrescarTempos() {
    if (!hall) return;
    Array.prototype.forEach.call(hall.querySelectorAll('.selo-quando'), function (el) {
      var t = el.getAttribute('data-ts');
      var novo = desde(t ? Number(t) : 0);
      if (el.textContent !== novo) el.textContent = novo;
    });
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
    var card = hall ? hall.querySelector('.cartao[data-id="' + id + '"]') : null;
    if (card) {
      repintaFuro(card, acha(id));
      refrescarTempos();
      if (rodape) rodape.textContent = resumo();
      if (card.scrollIntoView) { try { card.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    } else { render(); }
  }

  function soltar(id) {
    var t = escolhas();
    if (!t[id]) return;
    delete t[id];
    escrever(ESCOLHA_KEY, t);
    var card = hall ? hall.querySelector('.cartao[data-id="' + id + '"]') : null;
    if (card) { repintaFuro(card, acha(id)); if (rodape) rodape.textContent = resumo(); }
    else render();
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

  /* ---------- o chip do sync (na nuvem / local / erro) ----------
     Ele existe para uma pergunta só: "o que eu clicar aqui vai aparecer na tela do outro?"
     Desde a v1.37 a resposta não depende mais de entrar com e-mail — por isso o estado
     "falta entrar" saiu daqui. O que ainda merece voz é o contrário: dizer em voz alta quando
     a resposta for NÃO (modo local, sem internet, regra barrando). */
  function ligarStatus() {
    var chip = document.getElementById('syncChip');
    var store = global.ECLIPSE_STORE;
    if (!chip) return;
    if (!store) { chip.textContent = '⚙ sync não carregou'; chip.className = 'syncChip off'; return; }
    store.onStatus(function (s) {
      if (s.erro) { chip.className = 'syncChip bad'; chip.textContent = '⚠ ' + s.erro; return; }
      if (!s.online) { chip.className = 'syncChip mid'; chip.textContent = '⚠ sem internet — o jogo segue local e atravessa sozinho quando voltar'; return; }
      if (s.modo === 'nuvem') {
        chip.textContent = '☁ sincronizando · ' + s.mesa + (s.pendentes ? ' · ' + s.pendentes + ' subindo' : '') + (s.naVem ? ' · ' + s.naVem + ' chaves no banco' : '');
        chip.className = 'syncChip on';
      } else {
        chip.textContent = '⛺ modo local — o que você clicar não sai deste navegador';
        chip.className = 'syncChip off';
      }
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
           escolha na hora. O resto dos cards só é corrigido no `change` — e mesmo assim
           sem redesenhar, porque o selo depende do nome de quem está olhando. */
        if (pendente && inp.value.trim()) { var id = pendente; pendente = null; escolher(id); }
      });
      inp.addEventListener('change', function () { atualizar(); });
    }

    hall.addEventListener('click', function (ev) {
      var t = ev.target;
      function up(sel) { return t.closest ? t.closest(sel) : null; }
      var bEscolher = up('[data-escolher]'), bTomar = up('[data-tomar]'), bSoltar = up('[data-soltar]');
      if (bEscolher) { escolher(bEscolher.getAttribute('data-escolher')); return; }
      if (bTomar) { tomar(bTomar.getAttribute('data-tomar')); return; }
      if (bSoltar) { ev.preventDefault(); soltar(bSoltar.getAttribute('data-soltar')); return; }
      if (up('.btn-abrir')) return; // navega sozinho
      /* Toque no "detalhes": no celular não existe hover, então o card abre e fecha por aqui. */
      var bMais = up('.cartao-mais-btn');
      if (bMais) {
        var c0 = bMais.closest('.cartao');
        if (c0) {
          var aberto = c0.classList.toggle('mostra-mais');
          bMais.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        }
        return;
      }
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
       mesmo evento quando a nuvem escreve no cache). Antes isto chamava render() — e a
       rajada de eventos da carga inicial era exatamente o lag que a pessoa sentiu. Agora:
       junta todos os avisos de 400 ms numa passada só, e ela corrige os cards no lugar. */
    var adiado = null;
    global.addEventListener('storage', function (e) {
      if (e && e.key && e.key.indexOf('eclipse_') !== 0) return; // nada de fora da mesa nos interessa
      if (adiado) return;
      adiado = setTimeout(function () { adiado = null; atualizar(); }, 400);
    });

    /* Card de quem acabou de ser escolhido entra primeiro na vista em telas estreitas. */
    var eu = quemEuSou();
    if (!eu) { var d = document.getElementById('euNome'); if (d) d.placeholder = 'ex.: Thales, Flora, mestre…'; }
  });
})(window);
