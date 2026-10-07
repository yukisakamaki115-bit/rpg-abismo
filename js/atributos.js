/* ===== Éclipse — js/atributos.js: a regra de criação dos atributos, num lugar só =====
   Ele fechou a regra em 06/10: todo atributo nasce em **1**, cada um aceita no máximo **4**
   pontos (teto 5) e a pessoa tem **10** pontos para distribuir entre os cinco. Antes disso
   cada ficha vinha com números que eu tinha inventado (a Flora somava 67) e a caixinha ia até
   30 — não existia limitador nenhum.

   Por que um arquivo separado: são QUATRO motores desenhando atributo (flor.js,
   personagem2.js, personagem3.js e o js/ficha-comum.js das fichas 4 e 5) mais o painel do
   mestre, que também mexe nos números dos outros. Regra que mora em cinco arquivos vira cinco
   regras diferentes — a mesa ia descobrir que a Flora pode 14 e o Nox não.

   O que mora aqui:
   1. os três números da regra (`base`, `porAtributo`, `pool`) — trocar um aqui troca em tudo;
   2. `ajustar()` — a trava: nenhum valor passa do teto nem do que sobrou dos 10 pontos;
   3. `motivo()` — a frase que explica por que a caixinha devolveu outro número. Trava muda
      número sem dizer nada é o tipo de coisa que faz a pessoa achar que o site está quebrado;
   4. `regra()` — a migração. Ficha salva no navegador de alguém tem atributo de outro mundo,
      e o estado salvo SEMPRE vence o padrão do arquivo (foi a lição da v1.31.2). Então a
      primeira vez que a ficha abre com esta regra os cinco voltam para 1 e os 10 pontos ficam
      livres. Uma vez só: ela marca `state.atrRegra` e não mexe mais em nada depois disso;
   5. `painel()` — a linha que escreve a regra na tela + o contador de pontos, encaixada na
      grade que cada motor já monta (o motor não precisa saber desenhar nada disso);
   6. `mod()` — desde que o atributo vale 1..5, **o número É o bônus** que soma no d10. As três
      fichas antigas ainda carregavam a conta de D&D `(valor − 10) ÷ 2`, que com atributo 1..5
      devolveria 0 em tudo: o ataque da Flora, do Nox e do Dante ficaria mudo em silêncio.

   Carregado pelas 7 páginas, antes de qualquer motor de ficha. */
(function () {
  'use strict';

  var BASE = 1;          // de onde todo atributo parte
  var POR_ATRIBUTO = 4;  // máximo de pontos que UM atributo aceita
  var POOL = 10;         // pontos para distribuir na ficha inteira
  var TETO = BASE + POR_ATRIBUTO;
  var MARCA = 'pontos-' + BASE + '-' + POR_ATRIBUTO + '-' + POOL;
  var CHAVES = ['forca', 'destreza', 'constituicao', 'inteligencia', 'carisma'];

  function num(v) { v = Math.round(Number(v)); return isFinite(v) ? v : BASE; }
  function investido(v) { return Math.max(0, num(v) - BASE); }

  function valorDe(state, k) {
    var a = state && state.atributos && state.atributos[k];
    return (a && typeof a.valor === 'number') ? a.valor : BASE;
  }

  /* Quantos pontos já foram colocados. `exceto` deixa de fora a caixinha que está sendo
     editada agora — senão o ponto que a pessoa está tentando tirar do próprio atributo seria
     contado como se ainda estivesse gasto, e a soma travaria em 10 para sempre. */
  function usados(state, exceto) {
    var t = 0;
    CHAVES.forEach(function (k) { if (k !== exceto) t += investido(valorDe(state, k)); });
    return t;
  }
  function livres(state) { return POOL - usados(state); }

  var ultimoMotivo = '';
  function motivo() { var m = ultimoMotivo; ultimoMotivo = ''; return m; }

  /* A trava. Devolve o maior número legal para `chave`, dados os pontos já gastos nas
     outras quatro, e guarda a explicação quando ela morde. */
  function ajustar(state, chave, pedido) {
    var v = num(pedido);
    ultimoMotivo = '';
    if (v < BASE) { ultimoMotivo = 'o piso de qualquer atributo é ' + BASE + ' — não existe atributo zerado nesta mesa'; v = BASE; }
    if (v > TETO) { ultimoMotivo = 'cada atributo aceita no máximo ' + POR_ATRIBUTO + ' pontos, então o teto dele é ' + TETO; v = TETO; }
    var sobra = POOL - usados(state, chave);
    var peloPool = BASE + Math.max(0, sobra);
    if (v > peloPool) {
      v = peloPool;
      ultimoMotivo = sobra <= 0
        ? 'acabaram os seus ' + POOL + ' pontos — tire de outro atributo antes de subir este'
        : 'só sobram ' + sobra + ' ponto' + (sobra === 1 ? '' : 's') + ' dos ' + POOL + ' que você tem';
    }
    return v;
  }

  /* ---------- migração de regra ----------
     Zera os atributos para a base UMA vez por ficha. Além do bloco principal ela alcança o
     `state.persAttrs` da Tessalha (os conjuntos arquivados por personalidade): aquele arquivo
     foi criado com os números velhos, e a forma dele de se consertar é não existir mais — o
     `attrsSetup()` do js/vesper.js recria os três a partir do CONF, que já vem na regra nova. */
  function regra(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.atrRegra === MARCA) return false;
    var mudou = false;
    if (state.atributos && typeof state.atributos === 'object') {
      CHAVES.forEach(function (k) {
        var a = state.atributos[k];
        if (a && typeof a === 'object' && a.valor !== BASE) { a.valor = BASE; mudou = true; }
      });
    }
    if (state.persAttrs && typeof state.persAttrs === 'object') { delete state.persAttrs; mudou = true; }
    state.atrRegra = MARCA; // marca sempre: sem ela a ficha zerava de novo a cada F5 e comia a distribuição da pessoa
    return true; // mudou sempre: a marca é novidade na primeira vez
  }

  /* ---------- o pedaço de tela ----------
     `painel(box, state)` escreve a linha da regra logo acima da grade e anota em cada card
     quantos pontos aquele atributo já levou. Ele é chamado depois que o motor desenha a grade,
     então a ordem dos cards é a mesma de `CHAVES` nos quatro motores (todos iteram as cinco
     chaves canônicas na mesma ordem — é o contrato da v1.22). */
  var ESTILO = '.atr-regra{margin:0 0 10px;padding:9px 12px;border-left:3px solid var(--fs-accent,#c9a24b);' +
    'background:var(--fs-glow,rgba(201,162,75,.10));border-radius:0 8px 8px 0;font-size:13px;line-height:1.5}' +
    '.atr-contador{display:inline-block;margin-left:6px;font-weight:700}' +
    '.atr-contador.vazio{opacity:.55;font-weight:400}' +
    '.atr-motivo{display:block;margin-top:4px;color:#e0663d;font-weight:600}' +
    '.atr-inv{margin-top:5px;font-size:11px;letter-spacing:.4px;text-transform:uppercase;opacity:.7}' +
    '.atr-inv.vazio{color:#e0a63d}.atr-inv.cheio{color:#7bbf6a}';

  function estilo() {
    if (document.getElementById('eclipse-atr-estilo')) return;
    var s = document.createElement('style');
    s.id = 'eclipse-atr-estilo';
    s.textContent = ESTILO;
    document.head.appendChild(s);
  }

  function textoRegra() {
    return '✦ A regra da mesa: cada atributo nasce em ' + BASE + ', aceita no máximo ' +
      POR_ATRIBUTO + ' pontos (teto ' + TETO + ') e você tem ' + POOL +
      ' pontos para distribuir entre os cinco.';
  }

  function painel(box, state) {
    if (!box || !state) return;
    estilo();
    var linha = box.previousElementSibling;
    if (!linha || linha.className.indexOf('atr-regra') === -1) {
      linha = document.createElement('p');
      linha.className = 'atr-regra';
      box.parentNode.insertBefore(linha, box);
    }
    while (linha.firstChild) linha.removeChild(linha.firstChild); // limpa sem innerHTML: nada aqui vem de texto de pessoa
    var b = document.createElement('b');
    b.textContent = textoRegra();
    linha.appendChild(b);
    var gastos = usados(state), sobra = POOL - gastos;
    var cont = document.createElement('span');
    cont.className = 'atr-contador' + (sobra ? ' vazio' : '');
    cont.textContent = ' — Pontos: ' + gastos + '/' + POOL + ' usados' + (sobra ? ' · ' + sobra + ' livres' : ' · não sobrou nenhum');
    linha.appendChild(cont);
    var porque = motivo();
    if (porque) {
      var m = document.createElement('span');
      m.className = 'atr-motivo';
      m.textContent = '⚠ ' + porque;
      linha.appendChild(m);
    }
    var cards = box.querySelectorAll('.attr-card, .m-attr');
    var alvo = cards.length === CHAVES.length ? cards : [];
    CHAVES.forEach(function (k, i) {
      if (!alvo.length) return;
      var card = alvo[i]; if (!card) return;
      var v = valorDe(state, k), postos = investido(v);
      var nota = card.querySelector('.atr-inv');
      if (!nota) { nota = document.createElement('div'); nota.className = 'atr-inv'; card.appendChild(nota); }
      nota.textContent = postos + ' de ' + POR_ATRIBUTO + ' pontos' + (postos >= POR_ATRIBUTO ? ' · no teto' : (postos ? '' : ' · nada colocado ainda'));
      nota.className = 'atr-inv' + (postos >= POR_ATRIBUTO ? ' cheio' : (postos ? '' : ' vazio'));
    });
  }

  /* O bônus que o atributo soma no d10. É o próprio número — ver o comentário do arquivo. */
  function mod(v) { return Math.max(0, num(v)); }

  window.ECLIPSE_ATR = {
    base: BASE, porAtributo: POR_ATRIBUTO, pool: POOL, teto: TETO, chaves: CHAVES, marca: MARCA,
    ajustar: ajustar, livres: livres, usados: usados, investido: investido, motivo: motivo,
    regra: regra, painel: painel, textoRegra: textoRegra, mod: mod
  };
})();
