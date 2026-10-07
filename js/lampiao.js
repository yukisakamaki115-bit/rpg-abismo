/* ===== O lampião da Clara — bloco próprio de uma ficha do motor compartilhado =====
   Este arquivo NÃO é do motor: é o poder de UMA personagem, desenhado sobre as portas
   que js/ficha-comum.js abriu na v1.31 (window.FICHA_API). Ficha sem CONF.lampiao
   (a Tessalha, por exemplo) não carrega nada daqui e não vê diferença nenhuma.

   Por que em arquivo separado e não dentro do motor: o motor atende N fichas, então ele
   não pode conhecer alma nenhuma de personagem. O que é dela mora aqui + em js/ficha5.js
   (os números). Se amanhã nascer uma sexta ficha com poder próprio, é um irmão deste
   arquivo — não mais uma cópia de 1.100 linhas do personagem2.js.

   As três travas de balanceamento (vieram do pedido dele, não da minha cabeça):
   1) nenhuma invocação funciona no Mundo Real — "ela não tem poderes fora do crepúsculo";
   2) tudo custa 🕯️ alma, e alma só cabe 6 no vidro (conseguida uma de cada vez, num teste
      de d10 + Inteligência ≥ 11 — a parada veio de 22 para 11 quando a mesa fechou a regra nova
      dos atributos valendo 1..5; com Int 5 é ~50%, a mesma chance de antes);
   3) o dano vem da tabela impressa, com teto em 9 — ela nunca soma isso em cima de outro
      poder dela, porque não tem outro. E o 1 do dado cobra sanidade DELA.

   Estado: vive em state.lampiao dentro da MESMA chave da ficha (eclipse_ficha5_v1), pra
   continuar sendo uma história só quando o mestre abre a ficha ele na tela do mestre. */
(function (global) {
  'use strict';

  const API = global.FICHA_API;
  const CONF = global.FICHA_CONF;
  if (!API || !CONF || !CONF.lampiao) return; // motor velho na cache, ou ficha sem lampião: apaga-se

  const host = document.getElementById('lampiaoArea');
  if (!host) return;

  const L = CONF.lampiao;
  const MARK = L.alma.marca || '🕯️';

  /* ---------- estado próprio, sempre lido pelo API.state() (a engine troca o objeto
     dela quando o mestre salva noutra aba — guardar uma referência seria escrever em
     coisa morta, o mesmo erro que já custou dados nesta mesa) ---------- */
  function lamp() {
    const s = API.state();
    if (!s.lampiao || typeof s.lampiao !== 'object') s.lampiao = {};
    const o = s.lampiao;
    if (o.mundo !== 'real' && o.mundo !== 'crepusculo') o.mundo = 'real';
    if (typeof o.almas !== 'number') o.almas = 0;
    o.almas = API.clamp(o.almas, 0, L.almasMax);
    o.longe = !!o.longe;
    return o;
  }

  /* A penalidade de ficar longe dele entra pelo gancho do motor: é um estado próprio,
     não um chip — chip ela (ou o clique) apagaria sem querer e o vínculo sumiria. */
  API.hook(L.longe.marca || '🚫', function () {
    return lamp().longe ? (L.longe.penalidade || 0) : 0;
  });

  /* ---------- o que o painel do mestre mostra, escrito pela própria ficha ---------- */
  function publicar() {
    const o = lamp();
    const s = API.state();
    s.lampiaoResumo = (o.mundo === 'crepusculo' ? '🕯️ No crepúsculo' : '🌍 Mundo Real') +
      ' · ' + MARK + ' ' + o.almas + '/' + L.almasMax + (o.longe ? ' · 🚫 sem o lampião' : '');
    API.save();
  }

  /* ---------- desenho ---------- */
  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function btn(id, cls, txt) {
    const b = el('button', 'mini-btn' + (cls ? ' ' + cls : ''), txt);
    b.type = 'button'; b.id = id;
    return b;
  }
  function tabela(nome, spec) {
    const wrap = el('div', 'lamp-tab');
    wrap.appendChild(el('p', 'm-block-title', spec.nome + ' · custa ' + spec.custo + ' ' + MARK + ' · só dentro do crepúsculo'));
    /* Como ler: sem esta linha a tabela vira um menu de escolha, e ela não é escolha.
       É um cardápio de consequências: o d10 decide a linha, ninguém decide no lugar dele. */
    /* 06/10: estas três palavras têm que ser as MESMAS das quatro colunas logo abaixo
       (`no dado` · `o que vem` · `dano no alvo` · `o que cobra dela`). Enquanto falou
       "o que ela vê", quem lia o aviso procurava uma coluna que não existia. */
    wrap.appendChild(el('p', 'lamp-comoler',
      'Leia só a linha do número que saiu no dado: ' +
      'o que vem · o dano no alvo · o que cobra dela. ' +
      'Onde aparece “—” não tem dano nenhum: a tabela entregou uma situação, não uma queimadura.'));
    const tb = el('table', 'lamp-tb');
    const head = el('tr');
    ['no dado', 'o que vem', 'dano no alvo', 'o que cobra dela'].forEach(function (h) { head.appendChild(el('th', null, h)); });
    tb.appendChild(head);
    spec.tabela.forEach(function (linha, i) {
      const tr = el('tr');
      tr.appendChild(el('td', 'lamp-face', String(i + 1)));
      const celula = el('td', 'lamp-r');
      celula.appendChild(document.createTextNode(linha.r));
      /* Linha que pede uma cena inventada na hora: a tabela dá a situação, o conteúdo é
         de quem narra. Deixar isso escrito evita o "agora quem fala?" no meio da mesa. */
      if (linha.cena) celula.appendChild(el('small', 'lamp-cena', '🗣️ ' + linha.cena));
      tr.appendChild(celula);
      tr.appendChild(el('td', 'lamp-d', linha.dano ? linha.dano + ' de dano' : '—'));
      const cobra = [];
      if (linha.san) cobra.push((linha.san > 0 ? '+' : '−') + Math.abs(linha.san) + ' sanidade');
      if (linha.almas) cobra.push((linha.almas > 0 ? '+' : '−') + Math.abs(linha.almas) + ' ' + MARK);
      if (linha.marca) cobra.push('fica com “' + linha.marca + '” na ficha — sem número, é dívida de cena, não muda rolagem');
      tr.appendChild(el('td', 'lamp-c', cobra.length ? cobra.join(' · ') : 'nada'));
      tb.appendChild(tr);
    });
    wrap.appendChild(tb);
    return wrap;
  }

  let pronto = false;
  function desenhar() {
    const o = lamp();
    if (!pronto) {
      host.innerHTML = '';

      const faixa = el('div', 'lamp-strip');
      faixa.appendChild(btn('lampMundo', 'lamp-mundo'));
      const almas = el('span', 'lamp-almas'); almas.id = 'lampAlmas';
      faixa.appendChild(almas);
      faixa.appendChild(btn('lampLonge', 'lamp-longe'));
      host.appendChild(faixa);

      const acoes = el('div', 'lamp-acoes');
      acoes.appendChild(btn('lampAlmaBtn', 'ok', '👁️ procurar uma alma perdida'));
      acoes.appendChild(btn('lampFogoBtn', 'danger', '🔥 chamar o fogo'));
      acoes.appendChild(btn('lampVozBtn', 'danger', '🐙 chamar a criatura antiga'));
      host.appendChild(acoes);

      host.appendChild(Object.assign(el('p', 'lamp-result'), { id: 'lampResult' }));
      host.appendChild(el('p', 'hint-note', 'O passo a passo, com um turno de exemplo, está escondido no “🕯️ Como usar o lampião” acima — clica na linha pra abrir. A aleatoriedade é do lampião, não de quem narra: o que sai é exatamente a linha que o dado apontou. No Mundo Real ele só alumbra alma — as duas invocações pedem que ela esteja do outro lado da porta.'));

      const blocos = el('div', 'lamp-tabellas');
      blocos.appendChild(tabela('fogo', L.invocar.fogo));
      blocos.appendChild(tabela('voz', L.invocar.voz));
      host.appendChild(blocos);

      const aberto = el('div', 'story-block lamp-aberto');
      aberto.appendChild(el('p', 'm-block-title', '☐ Ainda não se sabe'));
      aberto.appendChild(el('p', 'story-text', 'O que ela faz lá dentro do crepúsculo — de propósito, sem texto inventado. Ela atravessa, o lampião responde, e o resto é o mestre quem escreve. Quando ele souber, entra aqui (e vira regra, com número, como o resto).'));
      host.appendChild(aberto);

      ligar();
      pronto = true;
    }
    const m = document.getElementById('lampMundo');
    if (m) m.textContent = o.mundo === 'crepusculo' ? '🗝️ voltar por uma porta' : '🗝️ abrir uma porta e atravessar';
    const a = document.getElementById('lampAlmas');
    if (a) {
      a.textContent = MARK + ' ' + o.almas + ' / ' + L.almasMax;
      a.title = 'almas perdidas no vidro do lampião';
    }
    const lg = document.getElementById('lampLonge');
    if (lg) lg.textContent = o.longe ? '✋ o lampião voltou pra mão dela' : '🚫 ficar longe do lampião';
    const f = document.getElementById('lampFogoBtn');
    if (f) custar(f, '🔥 chamar o fogo', L.invocar.fogo.custo);
    const v = document.getElementById('lampVozBtn');
    if (v) custar(v, '🐙 chamar a criatura antiga', L.invocar.voz.custo);
    publicar();
  }

  /* etiqueta + preço, montado em nó (nada de innerHTML com texto que vem de config) */
  function custar(b, rotulo, custo) {
    b.textContent = '';
    b.appendChild(document.createTextNode(rotulo + ' '));
    b.appendChild(el('small', null, '(' + custo + ' ' + MARK + ')'));
  }

  function saida(txt, cor) {
    const p = document.getElementById('lampResult');
    if (!p) return;
    p.textContent = txt;
    p.className = 'lamp-result show' + (cor ? ' ' + cor : '');
  }

  /* ---------- regras ---------- */
  function semForca() {
    const s = API.state();
    if (s.hp > 0) return false;
    saida('☠️ Sem forças, não age. É o mestre (ou quem cuida dela) quem levanta.', 'ruim');
    return true;
  }
  function dentroDoCrepusculo() {
    if (lamp().mundo === 'crepusculo') return true;
    saida('🌍 Aqui ela não é nada além de uma moça com um arco. O lampião alumbra, mostra almas — e para. As invocações só respondem do outro lado da porta.', 'ruim');
    return false;
  }
  function comOLampiao() {
    if (!lamp().longe) return true;
    saida('🚫 Sem o lampião na mão não tem invocação nenhuma — e olha que ela tentou largar.', 'ruim');
    return false;
  }

  function atravessar() {
    const o = lamp();
    o.mundo = o.mundo === 'crepusculo' ? 'real' : 'crepusculo';
    API.save();
    API.activity(CONF.quem, o.mundo === 'crepusculo' ? '🗝️ girou a chave numa porta qualquer e atravessou' : '🗝️ voltou por uma porta pro mundo real');
    desenhar();
    saida(o.mundo === 'crepusculo'
      ? '🗝️ A porta abre pra ela em qualquer lugar — tranca de cafeteria, porta de armário, portão. Do lado de dentro, o brilho vermelho do lampião é a única coisa que parece ter pressa.'
      : '🌍 De volta às noites do mundo real. Aqui o lampião só alumbra, e é o bastante pra encontrar o que se perdeu.', 'bom');
  }

  function largar() {
    const o = lamp();
    o.longe = !o.longe;
    API.save();
    API.activity(CONF.quem, o.longe ? '🚫 tentou ficar longe do lampião' : '✋ voltou pro pé do lampião');
    desenhar();
    saida(o.longe
      ? '🚫 Ela não consegue. Longe dele tudo fica meio surdo: ' + (L.longe.penalidade || -2) + ' em cada rolagem dela, e nenhuma invocação sai.'
      : '🕯️ De volta. O vidro esquenta na mão dela antes de ela terminar de pegar.', 'bom');
  }

  function procurarAlma() {
    if (semForca() || !comOLampiao()) return;
    const o = lamp();
    if (o.almas >= L.almasMax) { saida('🕯️ O vidro está cheio (' + L.almasMax + '). Ela teria que despejar uma alma em algum lugar — e isso o mestre decide se dá.', 'ruim'); return; }
    const spec = L.alma;
    const a = API.state().atributos[spec.attr];
    const b = API.bonus();          // o mesmo total que uma rolagem do motor usaria
    const det = API.bonusDetail();
    const face = API.face(10);
    const total = face + (a ? a.valor : 0) + b;
    const achou = total >= spec.alvo;
    if (achou) o.almas = API.clamp(o.almas + 1, 0, L.almasMax);
    API.roll({
      who: CONF.quem,
      txt: '🕯️ Procurou alma perdida (d10 ' + (a ? '+ ' + a.valor : '') + det + ' ≥ ' + spec.alvo + ')',
      total: total, detalhe: face, classe: face === 10 ? 'crit' : (face === 1 ? 'fumble' : '')
    });
    API.save(); desenhar();
    saida(achou
      ? '🎲 ' + face + ' + ' + ((a ? a.valor : 0) + b) + ' = ' + total + ' ≥ ' + spec.alvo + ' → ' + MARK + ' +1 (' + o.almas + '/' + L.almasMax + '). A alma estava onde a fumaça vermelha parou.'
      : '🎲 ' + face + ' + ' + ((a ? a.valor : 0) + b) + ' = ' + total + ' < ' + spec.alvo + ' → nada. A luz varreu o chão e não achou quem já foi.', achou ? 'bom' : '');
  }

  function invocar(spec, rotulo) {
    if (semForca() || !dentroDoCrepusculo() || !comOLampiao()) return;
    const o = lamp();
    if (o.almas < spec.custo) {
      saida('🕯️ Não tem alma suficiente no vidro: ' + rotulo + ' custa ' + spec.custo + ' e ela só tem ' + o.almas + '. Nada é gasto, nada é chamado.', 'ruim');
      return;
    }
    o.almas -= spec.custo; // paga primeiro, chama depois — igual às travas do Nox
    const face = API.face(10);
    const linha = spec.tabela[face - 1] || spec.tabela[0];
    const dano = Math.max(0, linha.dano || 0);
    const extras = [];
    if (linha.san) { API.vital('san', linha.san); extras.push((linha.san > 0 ? '+' : '−') + Math.abs(linha.san) + ' de sanidade'); }
    if (linha.almas) { o.almas = API.clamp(o.almas + linha.almas, 0, L.almasMax); extras.push((linha.almas > 0 ? '+' : '−') + Math.abs(linha.almas) + ' ' + MARK); }
    if (linha.marca) {
      if (API.chip.add(linha.marca)) extras.push('marca “' + linha.marca + '”');
      else extras.push('o vidro de efeitos está cheio (6) e “' + linha.marca + '” não coube');
    }
    API.roll({
      who: CONF.quem,
      txt: spec.nome + ' (d10 → ' + face + ' · ' + spec.custo + ' ' + MARK + ' paga)',
      total: dano, detalhe: linha.r + (linha.cena ? ' — ' + linha.cena : ''),
      classe: face === 10 ? 'crit' : (face === 1 ? 'fumble' : '')
    });
    API.save(); desenhar();
    saida('🎲 ' + face + ' → ' + linha.r + (linha.cena ? ' — ' + linha.cena : '') + '. ' + (dano ? dano + ' de dano. ' : 'Nada queima. ') +
      (extras.length ? 'E cobra dela: ' + extras.join(', ') + '.' : '') + ' Vidro em ' + o.almas + '/' + L.almasMax + '.',
      dano ? 'bom' : 'ruim');
  }

  function ligar() {
    const on = function (id, fn) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', fn);
    };
    on('lampMundo', atravessar);
    on('lampLonge', largar);
    on('lampAlmaBtn', procurarAlma);
    on('lampFogoBtn', function () { invocar(L.invocar.fogo, 'o fogo'); });
    on('lampVozBtn', function () { invocar(L.invocar.voz, 'a criatura antiga'); });

    /* O tutorial é HTML estático (ficha5.html). Aqui ele só aprende a lembrar se
       ela quer ele aberto — fechado por padrão, pra não ocupar a tela inteira. */
    const tut = document.getElementById('lampTutorial');
    if (tut) {
      tut.open = !!lamp().tutAberto;
      tut.addEventListener('toggle', function () {
        const o = lamp();
        if (o.tutAberto === tut.open) return;
        o.tutAberto = tut.open;
        API.save();
      });
    }
  }

  desenhar();
  global.__LAMPIAO_OK = true; // a aba do lampião carregou (o banner da página usa isto)
})(window);
