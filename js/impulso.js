/* ===== O impulso do ágil — bloco próprio da ficha 6 =====
   Irmão do js/lampiao.js: é o poder de UMA personagem escrito sobre as portas que o motor
   js/ficha-comum.js abriu. Ficha sem CONF.impulso (a Clara, a Tessalha) não carrega nada daqui
   e não vê diferença nenhuma.

   O que ele pediu, em uma frase: "o poder dele permite aumentar atributos em +2 ou mais
   sacrificando sanidade, máximo de +4 em tudo e mínimo de -8 de sanidade por uso de buff.
   Buff no corpo, alimentando status."

   As quatro travas que isso virou (são dele, não da minha cabeça):
   1) cada dose vale +2 num atributo e cobra 8 de Sanidade NA HORA — o "mínimo de −8 por uso";
   2) teto de +4 no mesmo atributo E +4 somando tudo: ou dois atributos em +2, ou um em +4.
      Passou disso, o botão recusa e explica, em português, o que já está aceso;
   3) o bônus mora no gancho por atributo do motor (API.hookAttr), NUNCA dentro de
      `atributos[k].valor`. Se entrasse no valor, o contador dos 10 pontos da criação leria o
      buff como se fosse ponto distribuído — e é exatamente assim que uma regra de criação é
      comida por um poder;
   4) soltar devolve os pontos e NUNCA a Sanidade. O corpo empresta, a cabeça paga, e a paga
      não volta sozinha (se volta, e quando, é ☐ do mestre, escrito na ficha).

   E o "alimentando status", que é a parte que quase sempre se perde: como a foice e a pistola
   dele somam Destreza no dano (CONF.armaPorNome + `attr` na arma), uma dose acesa na Destreza
   aumenta a rolagem DELE e o dano DELE — o buff atravessa a ficha inteira em vez de virar
   enfeite de uma aba.

   Estado: vive em state.impulso dentro da MESMA chave da ficha (eclipse_ficha6_v1), pra continuar
   sendo uma história só quando o mestre abre a ficha dele na tela do mestre. */
(function (global) {
  'use strict';

  const API = global.FICHA_API;
  const CONF = global.FICHA_CONF;
  if (!API || !CONF || !CONF.impulso) return; // motor velho na cache, ou ficha sem impulso: apaga-se

  const host = document.getElementById('impulsoArea');
  if (!host) return;

  const P = CONF.impulso;
  const MARK = P.marca || '💨';
  const PASSO = P.passo || 2;
  const CUSTO = P.custo || 8;
  const TETO_ATTR = P.tetoAttr || 4;
  const TETO_TOTAL = P.tetoTotal || 4;
  /* A ordem canônica dos cinco é a mesma do motor e da regra dos pontos — o bloco não inventa
     ordem nenhuma, só empurra o atributo preferido dele para o começo da lista. */
  const ORDEM = ['forca', 'destreza', 'constituicao', 'inteligencia', 'carisma'];
  const NOMES = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', carisma: 'Carisma' };
  const lista = ORDEM.slice().sort(function (a, b) {
    if (a === P.foco) return -1;
    if (b === P.foco) return 1;
    return ORDEM.indexOf(a) - ORDEM.indexOf(b);
  });

  /* ---------- estado próprio, lido sempre pelo API.state() (a engine troca o objeto dela
     quando o mestre salva noutra aba; guardar referência seria escrever em coisa morta) ---------- */
  function corpo() {
    const s = API.state();
    if (!s.impulso || typeof s.impulso !== 'object') s.impulso = {};
    const o = s.impulso;
    if (!o.doses || typeof o.doses !== 'object') o.doses = {};
    lista.forEach(function (k) {
      const n = Math.floor(Number(o.doses[k]) || 0);
      o.doses[k] = Math.max(0, Math.min(TETO_ATTR, Math.floor(n / PASSO) * PASSO));
    });
    /* Se uma dose apareceu num atributo que não é um dos cinco (estado velho, cópia de
       ficha), ela some: só os cinco canônicos têm gancho registrado no motor. */
    Object.keys(o.doses).forEach(function (k) { if (ORDEM.indexOf(k) === -1) delete o.doses[k]; });
    return o;
  }
  function aceso(o) {
    let n = 0;
    ORDEM.forEach(function (k) { n += o.doses[k] || 0; });
    return n;
  }

  /* Cada atributo tem o gancho dele, registrado uma vez. O teto do gancho é o teto por
     atributo — a trava de +4 somando tudo é decidida antes de pagar, no botão. */
  ORDEM.forEach(function (k) {
    API.hookAttr(MARK, k, function () { return corpo().doses[k] || 0; }, TETO_ATTR);
  });

  /* ---------- o que o painel do mestre mostra, escrito pela própria ficha ---------- */
  function publicar() {
    const o = corpo();
    const s = API.state();
    const partes = [];
    ORDEM.forEach(function (k) { if (o.doses[k]) partes.push('+' + o.doses[k] + ' ' + NOMES[k]); });
    let txt = partes.length
      ? (MARK + ' corpo aceso: ' + partes.join(' · ') + ' · paga em sanidade')
      : (MARK + ' corpo quieto (+0)');
    if (typeof o.esquiva === 'number') txt += ' · 🌀 Esquiva ' + o.esquiva;
    /* Só grava se o texto mudou — e isto não é economia de disco, é trava de eco. O `storage`
       do motor chama este bloco de novo (API.onRedraw), e um save() incondicional aqui faria
       duas abas da MESMA ficha se responderem à distância para sempre: A grava → B redesenha
       e grava → A redesenha e grava → ... com uma escrita no Firebase a cada volta. Comparando
       antes, a segunda aba vê o texto igual e fica quieta. */
    if (s.impulsoResumo === txt) return;
    s.impulsoResumo = txt;
    API.save();
  }

  /* ---------- desenho ---------- */
  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  let pronto = false;
  function desenhar() {
    const o = corpo();
    if (!pronto) {
      host.innerHTML = '';

      const faixa = el('div', 'imp-strip');
      faixa.appendChild(el('span', 'imp-contador', '')).id = 'impContador';
      faixa.appendChild(el('button', 'mini-btn imp-soltar no-act', '✋ soltar o impulso')).id = 'impSoltar';
      host.appendChild(faixa);

      const grade = el('div', 'imp-grade');
      lista.forEach(function (k) {
        const row = el('div', 'imp-attr');
        row.appendChild(el('span', 'imp-nome', NOMES[k] + (k === P.foco ? ' ★' : '')));
        row.appendChild(el('span', 'imp-base', '')).id = 'impBase-' + k;
        row.appendChild(el('span', 'imp-boost', '')).id = 'impBoost-' + k;
        const mais = el('button', 'mini-btn ok imp-mais no-act', '+2');
        mais.id = 'impMais-' + k;
        mais.title = 'Paga ' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade') + ' agora e soma +2 em ' + NOMES[k] + '.';
        const menos = el('button', 'mini-btn imp-menos no-act', '−');
        menos.id = 'impMenos-' + k;
        menos.title = 'Desliga uma dose de ' + NOMES[k] + '. Os pontos voltam; a Sanidade paga não volta.';
        row.appendChild(mais);
        row.appendChild(menos);
        grade.appendChild(row);
      });
      host.appendChild(grade);

      const acoes = el('div', 'imp-acoes');
      acoes.appendChild(el('button', 'mini-btn imp-esquiva no-act', '🌀 rolar a Esquiva')).id = 'impEsquiva';
      host.appendChild(acoes);

      host.appendChild(el('p', 'imp-result')).id = 'impResult';
      host.appendChild(el('p', 'hint-note',
        'O passo a passo, com uma rodada de exemplo, está no “' + MARK + ' Como funciona o impulso” aqui em cima — clica na linha pra abrir. ' +
        'Resumo das travas: +2 por dose · ' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade') + ' por dose · máximo +4 no mesmo atributo e +4 somando tudo · ' +
        'soltar devolve os pontos e não devolve a Sanidade. O ★ é o atributo dele: velocidade, reflexo, mira e o dano das duas armas moram ali.'));

      const aberto = el('div', 'story-block imp-aberto');
      aberto.appendChild(el('p', 'm-block-title', '☐ Ainda não se sabe (é do mestre, não foi inventado)'));
      aberto.appendChild(el('p', 'story-text',
        'A Sanidade gasta volta um dia? Voltando dormindo, com o que de cena, ou nunca? O que ele vê quando a Sanidade chega em 0. ' +
        'De onde ele veio no mundo: a frase do jogador disse “militar”, não disse qual exército nem em que guerra. ' +
        'Está em aberto de propósito — aqui não entra texto escrito por quem programa a ficha.'));
      host.appendChild(aberto);

      ligar();
      pronto = true;
    }
    const total = aceso(o);
    const c = document.getElementById('impContador');
    if (c) {
      c.textContent = MARK + ' corpo: +' + total + ' / +' + TETO_TOTAL + ' · ' + (CONF.san.nome || 'Sanidade') + ' ' + API.state().san + '/' + API.state().sanMax;
      c.title = 'o + é o que está aceso agora; a Sanidade cai a cada dose';
    }
    lista.forEach(function (k) {
      const a = API.state().atributos[k];
      const base = document.getElementById('impBase-' + k);
      if (base) base.textContent = (a ? a.valor : 1) + ' na ficha';
      const boost = document.getElementById('impBoost-' + k);
      const d = o.doses[k] || 0;
      if (boost) {
        boost.textContent = d ? '→ +' + d + ' (fica ' + ((a ? a.valor : 1) + d) + ')' : '—';
        boost.className = 'imp-boost' + (d ? ' on' : '');
      }
      const mais = document.getElementById('impMais-' + k);
      if (mais) {
        mais.disabled = d >= TETO_ATTR || total >= TETO_TOTAL;
        /* O teto deixa o botão acinzentado, e o motivo tem que estar no botão — não só na
           cabeça de quem escreveu o js. Passar o mouse explica na hora, sem clique perdido. */
        if (mais.disabled) {
          mais.title = d >= TETO_ATTR
            ? '🚫 ' + NOMES[k] + ' já está no teto do impulso (+' + TETO_ATTR + ' ali). O corpo não empresta duas vezes do mesmo lugar.'
            : '🚫 Teto do poder: +' + TETO_TOTAL + ' somando tudo. Já está aceso ' + (aceso(o) ? ORDEM.filter(function (x) { return o.doses[x]; }).map(function (x) { return '+' + o.doses[x] + ' ' + NOMES[x]; }).join(' · ') : 'nada') + ' — desliga uma dose (−) antes de acender ' + NOMES[k] + '.';
        } else {
          mais.title = 'Paga ' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade') + ' agora e soma +2 em ' + NOMES[k] + '.';
        }
      }
      const menos = document.getElementById('impMenos-' + k);
      if (menos) menos.disabled = d <= 0;
    });
    const sol = document.getElementById('impSoltar');
    if (sol) sol.disabled = total <= 0;
    publicar();
  }

  function saida(txt, cor) {
    const p = document.getElementById('impResult');
    if (!p) return;
    p.textContent = txt;
    p.className = 'imp-result show' + (cor ? ' ' + cor : '');
  }

  /* A dose mudou o número de um card de Status e o que a lista "Bônus de" oferece. Sem esta
     chamada, a aba do impulso mostraria +4 e o card continuaria em +1 até a próxima
     rolagem — duas telas, dois números, e o jogador no meio da rodada sem saber em qual
     acreditar. O `if` é de propósito: motor velho na cache não tem a porta, e uma ficha
     nunca pode quebrar por causa do bloco que mora em cima dela. */
  function retocar() { if (API.refreshAttr) API.refreshAttr(); }

  /* ---------- travas, todas ditas em português antes de negar um clique ---------- */
  function semForca() {
    /* A trava é a do motor, não uma copiada aqui: vida no chão **ou** marca 🟡/☠️ do mestre.
       Com uma regra só, o mestre derruba o rapaz e o impulso para junto com a rolagem — se
       fosse cópia do `hp`, ele seguiria comprando +2 deitado no chão e pagando Sanidade à toa.
       Motor velho na cache não tem a porta: aí vale o que sempre valeu, a vida. */
    const caido = API.semForcas ? API.semForcas() : API.state().hp <= 0;
    if (!caido) return false;
    saida('☠️ No chão ele não corre nem pula — e o corpo não empresta o que a cabeça tem que pagar. É o mestre (ou quem cuida dele) quem levanta.', 'ruim');
    return true;
  }
  function travado(k, o) {
    const total = aceso(o);
    if ((o.doses[k] || 0) >= TETO_ATTR) {
      saida('🚫 ' + NOMES[k] + ' já está no teto do impulso (+' + TETO_ATTR + ' ali). O corpo não empresta duas vezes do mesmo lugar.', 'ruim');
      return true;
    }
    if (total >= TETO_TOTAL) {
      const ligados = ORDEM.filter(function (x) { return o.doses[x]; }).map(function (x) { return '+' + o.doses[x] + ' ' + NOMES[x]; }).join(' · ');
      saida('🚫 O teto do poder é +' + TETO_TOTAL + ' somando tudo, e hoje já está aceso: ' + ligados + '. Para acender ' + NOMES[k] + ', primeiro desliga uma dose (−) ou solta o impulso.', 'ruim');
      return true;
    }
    if (API.state().san < CUSTO) {
      saida('🚫 Falta ' + (CONF.san.nome || 'Sanidade') + ': a dose custa ' + CUSTO + ' e ele tem ' + API.state().san + '. Nada foi pago, nada foi aceso — a cabeça dele não empresta o que já não tem.', 'ruim');
      return true;
    }
    return false;
  }

  function acender(k) {
    if (semForca()) return;
    const o = corpo();
    if (travado(k, o)) return;
    /* paga primeiro, acende depois — a mesma ordem das travas do Nox e do lampião: se
       alguma conta der errado no meio, ele nunca fica com o buff de graça. */
    API.vital('san', -CUSTO);
    o.doses[k] = (o.doses[k] || 0) + PASSO;
    const s = API.state();
    API.roll({
      who: CONF.quem,
      txt: MARK + ' Impulso: +' + PASSO + ' em ' + NOMES[k] + ' (pagou ' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade') + ')',
      total: (s.atributos[k] ? s.atributos[k].valor : 1) + o.doses[k],
      detalhe: (s.atributos[k] ? s.atributos[k].valor : 1) + '+' + o.doses[k] + ' agora'
    });
    API.activity(CONF.quem, MARK + ' acendeu +' + PASSO + ' em ' + NOMES[k] + ' · −' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade'));
    API.save(); desenhar(); retocar();
    const sob = API.state().san;
    saida('💨 Corpo aceso: +' + (o.doses[k]) + ' em ' + NOMES[k] + '. ' + (CONF.san.nome || 'Sanidade') + ' ' + CUSTO + ' → ' + sob +
      '. Isso vale nas rolagens de ' + NOMES[k] + ' e no dano das armas que somam ' + NOMES[k] + '.' +
      (sob <= 0 ? ' Ele chegou em 0 de ' + (CONF.san.nome || 'Sanidade') + ' — o que isso significa na boca dele é decisão do mestre.' : ''), 'bom');
  }

  function desligar(k) {
    const o = corpo();
    if (!(o.doses[k] || 0)) { saida('— ' + NOMES[k] + ' não tem dose acesa nenhuma.', ''); return; }
    o.doses[k] -= PASSO;
    API.activity(CONF.quem, '✋ desligou uma dose de ' + NOMES[k]);
    API.save(); desenhar(); retocar();
    saida('✋ Uma dose de ' + NOMES[k] + ' desceu. Os pontos voltam na hora; os ' + CUSTO + ' de ' + (CONF.san.nome || 'Sanidade') + ' que pagaram ela continuam pagos — o corpo empresta, a cabeça paga.', 'bom');
  }

  function soltar() {
    const o = corpo();
    if (!aceso(o)) { saida('— Ele já está com o corpo quieto (+0). Nada para soltar.', ''); return; }
    ORDEM.forEach(function (k) { o.doses[k] = 0; });
    API.activity(CONF.quem, '✋ soltou o impulso inteiro');
    API.save(); desenhar(); retocar();
    saida('✋ Corpo quieto outra vez: todos os pontos do impulso voltaram para o chão. A ' + (CONF.san.nome || 'Sanidade') + ' gasta no caminho não volta com eles.', 'bom');
  }

  /* A Esquiva é o pedido "difícil de acertar" virando número: ele rola, o total vira a barra
     que o ataque do mestre precisa passar. O número publicado aparece no card dele no painel
     do mestre — sem isso, alguém teria que anotar em papel no meio da rodada. */
  function esquiva() {
    if (semForca()) return;
    const spec = P.esquiva || { attr: P.foco || 'destreza', marca: '🌀' };
    const key = spec.attr;
    const a = API.state().atributos[key];
    const b = API.bonus(key);      // chips do mestre + ganchos globais + a dose acesa neste atributo
    const det = API.bonusDetail(key);
    const face = API.face(10);
    const total = face + (a ? a.valor : 0) + b;
    const o = corpo();
    o.esquiva = total;
    API.roll({
      who: CONF.quem,
      txt: (spec.marca || '🌀') + ' Esquiva (d10 ' + (a ? '+ ' + a.valor : '') + det + ')',
      total: total, detalhe: face, classe: face === 10 ? 'crit' : (face === 1 ? 'fumble' : '')
    });
    API.activity(CONF.quem, '🌀 rolou a Esquiva');
    API.save(); desenhar();
    saida('🌀 ' + face + ' + ' + (a ? a.valor : 0) + det + ' = ' + total +
      ' — quem tentar encostar nele agora precisa passar de ' + total + '. O número está no card dele, na tela do mestre.', 'bom');
  }

  function ligar() {
    const on = function (id, fn) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', fn);
    };
    lista.forEach(function (k) {
      on('impMais-' + k, function () { acender(k); });
      on('impMenos-' + k, function () { desligar(k); });
    });
    on('impSoltar', soltar);
    on('impEsquiva', esquiva);

    /* O tutorial é HTML estático (ficha6.html). Aqui ele só aprende a lembrar se o jogador
       quer ele aberto — fechado de padrão, pra não ocupar a tela inteira na mesa. */
    const tut = document.getElementById('impulsoTutorial');
    if (tut) {
      tut.open = !!corpo().tutAberto;
      tut.addEventListener('toggle', function () {
        const o = corpo();
        if (o.tutAberto === tut.open) return;
        o.tutAberto = tut.open;
        API.save();
      });
    }
  }

  desenhar();
  /* O motor desenha os cards de atributo antes deste arquivo existir, então os badges precisam
     de um redesenho agora que o gancho está registrado — e o bloco tem que se redesenhar
     quando o mestre salvar noutra aba (API.onRedraw é a porta para isso). */
  API.onRedraw(desenhar);
  API.redraw();

  global.__IMPULSO_OK = true; // o bloco do impulso carregou (o banner da página usa isto)
})(window);
