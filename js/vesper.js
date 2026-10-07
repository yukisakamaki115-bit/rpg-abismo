/* ===== Tessalha — as três personalidades: a aura da Tessalha, a Orbe do Trinstan e o Arco de Luz do Thalles =====
   Arquivo: js/vesper.js — o nome do arquivo é a matrícula dela (o storage usa isso e não se toca).
   06/10: o mestre deu o nome definitivo, TESSALHA. Onde este arquivo ainda diz "Vesper" é no
   apelido de trabalho antigo, que continua vivo no id da ficha e no alias do painel do mestre.
   Bloco próprio de UMA ficha, do mesmo jeito que js/lampiao.js é o da Clara: usa as portas
   que js/ficha-comum.js abre (window.FICHA_API) e não encosta no motor. O motor continua sem
   conhecer personalidade nenhuma — é isso que impede a ficha 4 de virar uma cópia de 1.100
   linhas como virou o personagem2.js.

   O pedido do mestre (01/10): "ela vai ser 3 personagens em 1... um botão pra mudar de
   personalidade sempre que quiser, e cada personalidade libera uma ficha nova, mantendo
   apenas vida e sanidade iguais, mas status e poder totalmente diferentes".

   Como isso é feito sem inventar um segundo motor:
   - vida e sanidade ficam onde já estavam (state.hp/san) — é o MESMO corpo, atravessa a troca;
   - os EFEITOS são arquivados por personalidade em state.persStatus, então cada uma chega com
     a própria lista de marcas e não herda a conversa das outras;
   - o PODER é um bloco por id, desenhado por uma função própria (`desenharPoder()` pergunta ao id
     quem ele é: `tessalha` desenha a caixinha de quem ela escuta, `trinstan` desenha a mira da
     Orbe, `thalles` desenha a mira e o medidor de cargas do arco; o que ainda é `vaga: true` desenha um aviso de "o mestre não escreveu esta ainda");
   - a COR da ficha é o `data-pers` no body: virar outra personalidade é ver a página mudar;
   - os CINCO STATUS são o conjunto de quem está no corpo (linha `attrs` por personalidade na
     config), e o que foi editado fica arquivado em state.persAttrs — trocar de humor troca a
     tabela inteira da aba Status.

   A TRAVA QUE NÃO PODE FALHAR: as marcas do mestre (☠️ Apagada / 🟡 Vacilando) são da PESSOA,
   não da personalidade. Se elas fossem arquivadas junto, ela trocaria de humor pra ressuscitar
   sozinha — e quem acende a brasa dela é ele, não ela.

   A Tessalha em uma frase: ela não faz nada com a própria mão. Ela ESCOLHE uma pessoa do grupo
   e passa a receber o bem que cai naquela pessoa. Por isso o poder é um leitor de `storage`:
   quem cura é a mesa (a ficha do aliado aberta noutra aba, o painel do mestre, uma carta do
   Dante) — o que muda lá dentro, ela sente aqui fora. Ela nunca escreve na ficha alheia.

   02/10 — A segunda personalidade que o mestre escreveu: TRINSTAN, "a razão entre os 3". Ele
   controla uma Orbe e a arremessa num inimigo; o que dói é a VELOCIDADE com que ela chega (o
   pedido dele foi "tipo o Q da Zoe"), e ele escolheu que a velocidade é SORTEADA, não atributo
   — então os 5 canônicos continuam intactos. Duas decisões que travam o desenho: o dano sai na
   tela e quem baixa a vida do inimigo é o MESTRE, na aba dele (a Orbe não escreve no bestiário
   nem em ficha nenhuma), e o arremesso cobra Vínculo dele mesmo — sem custo, "quanto mais
   rápido mais forte" viraria só apertar o botão pra sempre. Cada personalidade tem seu bloco de
   desenho aqui dentro; nada de uma é emprestado pra outra.

   Ainda no 02/10, ele cobrou a parte que tinha ficado pela metade: "cada personalidade libera uma
   ficha nova... status totalmente diferente" não era só poder e cor — os CINCO números trocam
   junto. A Tessalha é o conjunto impresso em CONF.attrs — que desde a regra nova está todo em
   1, porque agora é a jogadora quem distribui os 10 pontos dela; o Trinstan declara o dele
   (Força 1 / Destreza 5 / Constituição 2 / Inteligência 5 / Carisma 2) e o Thalles declara o dele
   (Força 4 / Destreza 5 / Constituição 2 / Inteligência 2 / Carisma 2), com os MESMOS 10 pontos
   gastos de propósito: se uma tivesse mais pontos que a outra, trocar de personalidade seria
   level up disfarçado. O corpo não entra nessa: Brasa e Vínculo são um só e atravessam a troca. O que
   ela (ou o mestre, pelo painel) editar num número fica no arquivo DAQUELA personalidade, e a
   aba Status imprime os conjuntos de todas — a ficha nunca esconde o número que ela vai somar.

   06/10 — Fechou a tríade: THALLES, o terceiro, com o Arco de Luz que o mestre ditou agora
   ("conjura um arco de luz extremamente potente, carregado, e as flechas dele causam dano à alma
   do alvo, tirando a vida máxima dele"). A história dos três já foi escrita (bloco "Os
   três", na aba Perfil do ficha4.html); a mecânica está toda aqui. Três decisões que o site tinha
   decidido antes dele pedir:
   ① a flecha NÃO escreve no bestiário — ela mostra a conta ("o teto vai de 40 para 37") e quem
      baixa o número é o MESTRE, pela mesma porta que a Orbe do Trinstan usa;
   ② tudo tem teto: cargas, alma por inimigo e vida máxima mínima de 1 — "tirar vida máxima para
      sempre" é o poder mais forte do site, e sem trava ele apaga um chefe em três cliques;
   ③ cobra Vínculo em cada carga, e o erro leva embora o que ele já pagou: é o único poder do
      grupo que pode perder recurso pago, e é isso que faz "carregar" ser uma decisão. */
(function (global) {
  'use strict';

  const API = global.FICHA_API;
  const CONF = global.FICHA_CONF;
  if (!API || !CONF || !Array.isArray(CONF.personalidades)) return; // motor velho na cache, ou ficha sem personalidades: apaga-se

  const strip = document.getElementById('persStrip');
  const host = document.getElementById('persPoder');
  if (!strip && !host) return;

  const T = CONF.tessalha || {};
  const MARK = T.marca || '🌿';
  /* As duas próximas linhas só existem por causa do texto impresso na tela: número coerido e
     marca sem caractere de tag, pra uma config nunca virar markup ao ser interpolada. */
  const ECO_MAX = Math.max(1, Math.min(5, Number(T.ecoMax) || 2));
  const MARK_TXT = String(MARK).replace(/[<>&"]/g, '');
  const ALVOS = Array.isArray(T.alvos) ? T.alvos : [];
  const GM = [CONF.eff.morta, CONF.eff.incap]; // o que só o mestre desfaz
  const NUM = /·\s*([+−])\s*(\d+)$/;           // o mesmo sufixo que o motor lê nos chips
  const ECO_PREFIXO = MARK + ' eco de ';

  /* ---------- os números do Trinstan (a Orbe) ----------
     Coagidos igual o ECO_MAX: estes valores vão parar dentro de texto na tela e de uma fórmula,
     então uma config malformada nunca pode abrir markup nem virar dano infinito. */
  const TR = CONF.trinstan || {};
  const TR_MARCA = String(TR.marca || '🌀').replace(/[<>&"]/g, '');
  const TR_DADO = Math.max(2, Math.min(20, Number(TR.dado) || 10));
  const TR_MULT = Math.max(1, Math.min(5, Number(TR.mult) || 2));
  const TR_PASSA = Math.max(0, Math.min(TR_DADO - 1, Number(TR.passaAte) || 0));
  const TR_CUSTO = Math.max(0, Math.min(5, Number(TR.custo) || 0));
  const TR_CUSTO_ERRO = Math.max(TR_CUSTO, Math.min(6, Number(TR.custoErro) || TR_CUSTO));
  const INIMIGOS = global.EclipseInimigos;
  const MOB_KEY = (INIMIGOS && INIMIGOS.KEY) || 'eclipse_inimigos_v1';

  /* ---------- os números do Thalles (o Arco de Luz) ----------
     Coagidos um por um, pelo mesmo motivo da Orbe: estes valores aparecem dentro de frases na
     tela e dentro de uma conta, então uma config malformada nunca pode abrir markup nem virar
     dano infinito. `critEm` é limitado pelo teto do dado senão o "em cheio" poderia virar um
     número que nunca sai e a flecha pararia de dobrar sem ninguém perceber. */
  const TH = CONF.thalles || {};
  const TH_MARCA = String(TH.marca || '🏹').replace(/[<>&"]/g, '');
  const TH_DADO = Math.max(2, Math.min(20, Number(TH.dado) || 10));
  const TH_CARGAS = Math.max(1, Math.min(6, Number(TH.cargasMax) || 3));
  const TH_C_CARGA = Math.max(0, Math.min(5, Number(TH.custoCarga) || 0));
  const TH_C_TIRO = Math.max(0, Math.min(5, Number(TH.custoTiro) || 0));
  const TH_C_ERRO = Math.max(TH_C_TIRO, Math.min(8, Number(TH.custoErro) || TH_C_TIRO));
  const TH_ERRA = Math.max(0, Math.min(TH_DADO - 1, Number(TH.erraAte) || 0));
  const TH_CRIT = Math.max(1, Math.min(TH_DADO, Number(TH.critEm) || TH_DADO));
  const TH_DANO = Math.max(0, Math.min(10, Number(TH.danoPorCarga) || 0));
  const TH_ALMA = Math.max(0, Math.min(5, Number(TH.almaPorCarga) || 0));
  const TH_ALMA_MAX = Math.max(TH_ALMA, Math.min(20, Number(TH.almaMax) || 0));

  /* ---------- estado ---------- */
  function st() { return API.state(); } // sempre lido na hora: o motor troca o objeto quando o mestre salva noutra aba

  function cfg(id) {
    const lista = CONF.personalidades.filter(function (p) { return p.id === id; });
    return lista.length ? lista[0] : null;
  }
  function atual() { return cfg(st().pers); }
  function tessalhaLigada() { return st().pers === 'tessalha'; }

  function ts() {
    const s = st();
    const primeira = (CONF.personalidades.filter(function (p) { return !p.vaga; })[0] || CONF.personalidades[0] || {}).id || null;
    if (!s.pers || !cfg(s.pers) || cfg(s.pers).vaga) s.pers = primeira; // personalidade apagada (ou o mestre trocou a lista) → volta pra que existe
    if (!s.persStatus || typeof s.persStatus !== 'object') s.persStatus = {};
    if (!s.tessalha || typeof s.tessalha !== 'object') s.tessalha = {};
    const t = s.tessalha;
    if (!alvoCfg(t.alvo)) t.alvo = null; // aliado que saiu do grupo não fica escolhido por inércia
    if (typeof t.tutAberto !== 'boolean') t.tutAberto = false;
    return t;
  }
  function alvoCfg(chave) {
    const a = ALVOS.filter(function (x) { return x.chave === chave; });
    return a.length ? a[0] : null;
  }

  /* ---------- o que é do Trinstan ---------- */
  function trinstanLigada() { return st().pers === 'trinstan'; }

  function tt() {
    const s = st();
    if (!s.trinstan || typeof s.trinstan !== 'object') s.trinstan = {};
    const o = s.trinstan;
    ['arremessos', 'melhor', 'ultimoVel', 'ultimoDano'].forEach(function (k) {
      if (typeof o[k] !== 'number' || !isFinite(o[k])) o[k] = 0;   // nada de NaN vindo de um storage velho
    });
    if (typeof o.tutAberto !== 'boolean') o.tutAberto = false;
    const m = mobPorId(o.alvo);
    if (o.alvo && !m) o.alvo = null; // o inimigo saiu da cena: a mira dele não fica apontando pro nada
    return o;
  }

  /* ---------- o que é do Thalles ---------- */
  function thallesLigada() { return st().pers === 'thalles'; }

  function th() {
    const s = st();
    if (!s.thalles || typeof s.thalles !== 'object') s.thalles = {};
    const a = s.thalles;
    ['cargas', 'tiros', 'melhorDano', 'melhorAlma', 'ultimaMira', 'ultimoDano', 'ultimaAlma'].forEach(function (k) {
      if (typeof a[k] !== 'number' || !isFinite(a[k])) a[k] = 0;
    });
    a.cargas = Math.max(0, Math.min(TH_CARGAS, Math.round(a.cargas))); // a config pode ter encolhido o arco
    if (typeof a.tutAberto !== 'boolean') a.tutAberto = false;
    if (!a.alma || typeof a.alma !== 'object') a.alma = {};             // quanta alma cada bicho já perdeu
    if (a.alvo && !mobPorId(a.alvo)) a.alvo = null;                    // o inimigo saiu da cena
    /* Bicho que saiu da cena leva a conta dele embora: sem isto, um id emprestado de volta pelo
       mestre herdaria a mordida antiga e entraria já no teto de alma sem nunca ter levado flecha. */
    const vivos = {};
    mobs().forEach(function (m) { vivos[String(m.id)] = 1; });
    Object.keys(a.alma).forEach(function (k) { if (!vivos[k]) delete a.alma[k]; });
    return a;
  }
  /* A mordida acumulada NAQUELE inimigo. É contada por id, então um bicho novo entra zerado e o
     que ele pediu pro mestre não pode ser farmado virando o mesmo nome várias vezes.
     Formato: { c: total de alma já cobrado (o que prende no teto de 6), b: o hpMax do mestre que
     serve de base, p: quanto foi cobrado DEPOIS daquela base }. Um número sozinho é estado velho:
     vira objeto e a base é amarrada na próxima leitura. */
  function almaPerdida(id) {
    if (!id) return 0;
    const v = th().alma[String(id)];                              // SÓ LE: desenhar a lista não pode criar conta
    const n = (v && typeof v === 'object') ? Number(v.c) : Number(v);
    return Math.max(0, Math.min(TH_ALMA_MAX, Math.round(n) || 0));
  }
  function almaDe(id) {
    if (!id) return null;
    const a = th(), k = String(id);
    let v = a.alma[k];
    if (typeof v === 'number' || typeof v === 'string') v = { c: Number(v) || 0, b: null, p: 0 };
    if (!v || typeof v !== 'object') v = { c: 0, b: null, p: 0 };
    v.c = Math.max(0, Math.min(TH_ALMA_MAX, Math.round(Number(v.c)) || 0));
    v.p = Math.max(0, Math.min(v.c, Math.round(Number(v.p)) || 0));
    v.b = (Number(v.b) >= 1 && isFinite(Number(v.b))) ? Math.round(Number(v.b)) : null;
    return (a.alma[k] = v);
  }

  /* A lista de bichos é do MESTRE (eclipse_inimigos_v1). Daqui só se LÊ: a Orbe mostra o número
     na tela e é ele quem baixa a vida na aba dele. */
  function mobs() {
    if (!INIMIGOS || typeof INIMIGOS.read !== 'function') return [];
    const l = INIMIGOS.read();
    return Array.isArray(l) ? l : [];
  }
  function mobPorId(id) {
    if (!id) return null;
    const m = mobs().filter(function (e) { return String(e.id) === String(id); });
    return m.length ? m[0] : null;
  }
  /* As marcas do mestre travam o braço dele: com ☠️/🟡 no corpo, a razão não sustenta a Orbe.
     É a mesma lógica do mortoBlock do motor, lida de fora (o motor não exporta aquela função). */
  function bloqueado() {
    const s = st();
    if (s.hp <= 0) return 'sem Brasa nenhuma';
    const marcada = s.status.filter(function (m) { return GM.indexOf(m) !== -1; });
    return marcada.length ? 'ele está sob ' + marcada[0] : '';
  }

  /* ---------- os cinco números de cada uma ----------
     "Cada personalidade é uma ficha nova" não valia só pro poder e pra cor: os STATUS também
     trocam com quem está no corpo. Brasa e Vínculo ficam (é o MESMO corpo), e o que ela ou o
     mestre editarem num número fica guardado por personalidade em state.persAttrs — senão
     trocar de humor apagaria em silêncio a edição dele. O motor continua sem saber o que é
     personalidade: quem escreve em state.atributos é este bloco, pela mesma porta do resto. */
  function coagirAttr(v) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return (window.ECLIPSE_ATR ? ECLIPSE_ATR.base : 0);
    // 06/10: o teto deixou de ser "o que o input aceite" e passou a ser a regra da mesa — base 1,
    // 4 pontos por atributo (js/atributos.js). Uma config que prometer número fora da faixa
    // agora não entra no corpo de ninguém.
    return Math.max(window.ECLIPSE_ATR ? ECLIPSE_ATR.base : 0,
      Math.min(window.ECLIPSE_ATR ? ECLIPSE_ATR.teto : 30, n));
  }

  /* Personalidade sem `attrs` próprios = o conjunto do corpo (CONF.attrs). É por isso que a
     Tessalha não declara número nenhum: ela É o que está impresso na ficha hoje. */
  function attrsDe(p) {
    const a = (p && p.attrs && typeof p.attrs === 'object') ? p.attrs : (CONF.attrs || {});
    const o = {};
    Object.keys(a).forEach(function (k) { o[k] = coagirAttr(a[k]); });
    return o;
  }

  function snapshotAttrs() {
    const s = st(), o = {};
    Object.keys(s.atributos || {}).forEach(function (k) { o[k] = coagirAttr(s.atributos[k].valor); });
    return o;
  }

  /* Só os VALORES mudam: o `nome` de cada atributo continua vindo de onde o motor pôs ali, e é
     dele que a tabela impressa tira os rótulos — escrever "Força" aqui dentro seria ter que
     lembrar de trocar em dois lugares. */
  function escreverAttrs(vals) {
    const s = st();
    if (!vals) return 0;
    let mudados = 0;
    Object.keys(s.atributos).forEach(function (k) {
      const v = coagirAttr(vals[k]);
      if (s.atributos[k].valor !== v) { s.atributos[k].valor = v; mudados++; }
    });
    return mudados;
  }

  /* A estreia da mecânica, UMA vez: um estado salvo de antes não tem arquivo nenhum, então ele
     é criado pelo que a config promete e aplicado em quem está no corpo agora. Depois disso o
     boot não reescreve nada — é isso que deixa o mestre editar um número sem perdê-lo no F5. */
  function attrsSetup() {
    const s = st();
    if (s.persAttrs && typeof s.persAttrs === 'object') return 0;
    s.persAttrs = {};
    CONF.personalidades.forEach(function (p) { if (!p.vaga) s.persAttrs[p.id] = attrsDe(p); });
    const mudaram = escreverAttrs(s.persAttrs[s.pers] || attrsDe(cfg(s.pers)));
    if (mudaram) API.redraw();
    API.save();
    return mudaram;
  }

  /* A tabela impressa na aba Status: os cinco números de cada uma, e qual deles está no corpo.
     Quem está no corpo lê o valor VIVO (o que pode ter sido editado por ela ou pelo mestre); as
     outras lêem o arquivo delas. É por isso que a tabela nunca diverge do que a rolagem soma. */
  function desenharAttrs() {
    const box = document.getElementById('persAttrs');
    if (!box) return;
    box.innerHTML = '';
    const s = st();
    const chaves = Object.keys(s.atributos || {});
    if (!chaves.length) return;
    box.appendChild(el('p', 'pers-attrs-titulo', 'Os status são de quem está no corpo — trocar de personalidade troca a tabela inteira'));
    CONF.personalidades.forEach(function (p) {
      const na = p.id === s.pers;
      const linha = el('div', 'pers-attrs-linha' + (na ? ' atual' : '') + (p.vaga ? ' vaga' : ''));
      const quem = el('span', 'pers-attrs-quem');
      quem.textContent = (p.emoji || '☐') + ' ' + (p.nome || 'ainda sem nome');
      linha.appendChild(quem);
      if (p.vaga) {
        linha.appendChild(el('span', 'pers-attrs-num', '— o mestre ainda não escreveu os números dela —'));
      } else {
        const set = na ? snapshotAttrs() : ((s.persAttrs && s.persAttrs[p.id]) || attrsDe(p));
        chaves.forEach(function (k) {
          linha.appendChild(el('span', 'pers-attrs-num', s.atributos[k].nome + ' ' + coagirAttr(set[k])));
        });
        if (na) linha.appendChild(el('span', 'pers-attrs-atual', 'no corpo'));
      }
      box.appendChild(linha);
    });
    box.appendChild(el('p', 'pers-attrs-nota', 'Brasa e Vínculo não entram aqui de propósito: são do corpo, e atravessam a troca inteiros. O que muda são só os cinco, o poder e a cor da página.'));
  }

  /* ---------- o que a Tessalha escuta ---------- */
  function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; }
  }
  /* A aura começa a escutar AGORA. Sem isso, voltar pra Tessalha depois de uma hora fora
     ecoaria tudo que a pessoa ganhou enquanto ela não estava olhando — e cura atrasada não
     é poder, é bug. */
  function ressincronizar() {
    const t = ts(), a = alvoCfg(t.alvo);
    const o = a ? ler(a.chave) : null;
    t.base = o ? { hp: o.hp, san: o.san, status: (o.status || []).slice() } : null;
  }

  function ecoAtivos() {
    return st().status.filter(function (m) { return String(m).indexOf(ECO_PREFIXO) === 0; });
  }

  /* A regra toda mora aqui: compara a ficha do aliado com o último retrato que ela guardou e
     só aproveita o que SUBIU. O que desceu (dano, maldição, carta do Dante) ela não toca —
     a Tessalha empresta sorte, não dor. */
  function receber(novo, a) {
    const t = ts();
    if (!novo || typeof novo.hp !== 'number') { t.base = null; return; }
    const b = t.base || { hp: novo.hp, san: novo.san, status: [] }; // primeiro contato nunca é ganho
    t.base = { hp: novo.hp, san: novo.san, status: (novo.status || []).slice() };
    if (!tessalhaLigada()) return;

    const ganhou = [], emprestimos = [];
    const s = st();

    const dhp = novo.hp - b.hp;
    if (dhp > 0) {
      const antes = s.hp;
      API.vital('hp', dhp);
      const real = API.state().hp - antes;
      if (real > 0) ganhou.push('+' + real + ' de ' + CONF.hp.nome);
    }
    const dsan = novo.san - b.san;
    if (dsan > 0) {
      const antes = s.san;
      API.vital('san', dsan);
      const real = API.state().san - antes;
      if (real > 0) ganhou.push('+' + real + ' de ' + CONF.san.nome);
    }
    (novo.status || []).forEach(function (marca) {
      if (b.status.indexOf(marca) !== -1) return;          // ela já tinha, não é novidade agora
      const m = NUM.exec(marca);
      if (!m || m[1] !== '+') return;                       // só o que soma: marca sem número é dívida de cena, e −N é dor
      const valor = Math.min(3, parseInt(m[2], 10) || 0);   // o mesmo teto do motor por marca
      if (valor > 0) emprestimos.push(ECO_PREFIXO + a.nome + ' · +' + valor);
    });

    const recebidos = [];
    emprestimos.forEach(function (novo2) {
      if (s.status.indexOf(novo2) !== -1) return;
      if (ecoAtivos().length >= ECO_MAX) {                  // a aura cabe dois empréstimos: o mais velho esvazia
        const velhos = ecoAtivos();
        API.chip.remove(velhos[0]);
        recebidos.push('“' + velhos[0] + '” se desfez pra dar lugar');
      }
      if (API.chip.add(novo2)) recebidos.push(novo2);
      else recebidos.push('o vidro de efeitos dela está cheio (6) e ' + novo2 + ' não coube');
    });

    if (!ganhou.length && !recebidos.length) { API.save(); return; }

    const frase = ganhou.concat(recebidos).join(' · ');
    const conta = ganhou.length
      ? ganhou.reduce(function (n, g) { return n + (parseInt(String(g).replace(/\D/g, ''), 10) || 0); }, 0)
      : recebidos.length;
    API.roll({
      who: CONF.quem,
      txt: MARK + ' ' + atual().nome + ' sentiu o bem que caiu em ' + a.nome + ' (passivo)',
      total: conta, detalhe: frase, classe: ''
    });
    publicar(); desenhar();
    saida('🌿 ' + frase + '. A aura não pediu nada emprestado — ela só chegou junto.', 'bom');
    API.save();
  }

  /* ---------- o que o painel do mestre mostra, escrito pela própria ficha ---------- */
  function publicar() {
    const s = st(), p = atual(), t = ts(), o = tt();
    const a = alvoCfg(t.alvo);
    let r = (p ? (p.emoji + ' ' + (p.nome || 'sem nome')) : '🎭 ?');
    if (tessalhaLigada()) {
      r += a ? ' · ' + MARK + ' eco de ' + a.nome + ' (' + ecoAtivos().length + '/' + ECO_MAX + ')' : ' · aura parada';
    } else if (trinstanLigada()) {
      const m = mobPorId(o.alvo);
      r += m ? ' · ' + TR_MARCA + ' mira em ' + m.nome + ' · ' + o.arremessos + ' arremesso' + (o.arremessos === 1 ? '' : 's')
             : ' · ' + TR_MARCA + ' orbe na mão, sem alvo';
    } else if (thallesLigada()) {
      const q = th(), m = mobPorId(q.alvo);
      r += m ? ' · ' + TH_MARCA + ' mira em ' + m.nome + ' · ' + q.cargas + '/' + TH_CARGAS + ' cargas'
             : ' · ' + TH_MARCA + ' ' + (q.cargas ? 'arco carregado (' + q.cargas + '/' + TH_CARGAS + '), sem alvo' : 'arco por conjurar');
      r += ' · ' + q.tiros + ' flecha' + (q.tiros === 1 ? '' : 's');
    }
    s.persResumo = r;
    API.save();
  }

  /* ---------- trocar de personalidade ---------- */
  function trocar(id) {
    const p = cfg(id);
    if (!p) return;
    if (p.vaga) { saida('☐ ' + id + ' ainda não existe: o mestre não escreveu o que ela faz.'); return; }
    const s = st();
    if (s.pers === id) return;
    const antiga = atual();

    /* As marcas do mestre atravessam a troca; o resto é arquivado por personalidade. */
    const antigaId = s.pers;
    const daMestre = s.status.filter(function (m) { return GM.indexOf(m) !== -1; });
    const suas = s.status.filter(function (m) { return GM.indexOf(m) === -1; });
    if (antigaId === 'tessalha') {
      /* Sair da Tessalha desfaz os empréstimos: a aura vai embora junto com ela. Toda outra
         personalidade guarda os próprios efeitos pra quando ela voltar. */
      s.persStatus[antigaId] = suas.filter(function (m) { return String(m).indexOf(ECO_PREFIXO) !== 0; });
    } else {
      s.persStatus[antigaId] = suas;
    }
    s.status = daMestre.concat(s.persStatus[id] || []).slice(0, 6); // o teto do motor vale pra lista montada também
    s.pers = id;

    /* Os cinco números viram os dela. O arquivo gravado é o da personalidade que sai — com o
       que ela ou o mestre editaram no caminho junto — e o que entra é o arquivo da que chega,
       ou o que a config promete se ela nunca assumiu o corpo. Roda antes do redraw() de
       propósito: é o state.atributos que o motor pinta na tela. */
    if (!s.persAttrs || typeof s.persAttrs !== 'object') s.persAttrs = {};
    s.persAttrs[antigaId] = snapshotAttrs();
    escreverAttrs(s.persAttrs[id] || attrsDe(p));
    s.persAttrs[id] = snapshotAttrs();
    const quais = Object.keys(s.atributos).map(function (k) { return s.atributos[k].nome + ' ' + s.atributos[k].valor; });

    if (id === 'tessalha') ressincronizar();
    document.body.setAttribute('data-pers', id);
    API.redraw();
    publicar(); desenhar();
    saida((p.emoji || '🎭') + ' ' + p.nome + ' assumiu. ' +
      'Os status no corpo agora: ' + quais.join(' · ') +
      '. Brasa e Vínculo continuam os mesmos — é o mesmo corpo. ' +
      (daMestre.length ? 'As marcas do mestre (' + daMestre.join(', ') + ') continuam nela — isso não se troca. ' : '') +
      (antiga ? 'O que ' + (antiga.nome || 'a outra') + ' tinha nos efeitos ficou guardado pra quando ela voltar.' : ''), 'bom');
    API.activity(CONF.quem, '🎭 virou ' + p.nome);
  }

  /* ---------- desenho ---------- */
  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function saida(txt, cor) {
    const p = document.getElementById('persResult');
    if (!p) return;
    p.textContent = txt;
    p.className = 'pers-result show' + (cor ? ' ' + cor : '');
  }

  /* ---------- o arremesso do Trinstan ----------
     Uma rolagem, um número, uma conta aberta na tela: velocidade sorteada × multiplicador. O que
     ela NÃO faz: somar os chips dele (a Orbe obedece à velocidade, não a efeitos), escrever no
     bestiário do mestre, ou sair de graça (cada lançamento cobra Vínculo). */
  function arremessar() {
    const o = tt(), s = st();
    const travado = bloqueado();
    if (travado) { saida('🌀 ' + atual().nome + ' não arremessa: ' + travado + '.', 'ruim'); return; }
    const m = mobPorId(o.alvo);
    if (!m) { saida('🌀 Sem inimigo escolhido na caixinha, a Orbe não tem para onde ir.', 'ruim'); return; }
    if (s.san < TR_CUSTO) { saida('🌀 Não sobrou Vínculo para pagar o arremesso (custa ' + TR_CUSTO + '). A razão dele acabou por hoje.', 'ruim'); return; }

    const vel = API.face(TR_DADO);
    const errou = vel <= TR_PASSA;
    const dano = errou ? 0 : vel * TR_MULT;
    const antes = API.state().san;
    API.vital('san', -(errou ? TR_CUSTO_ERRO : TR_CUSTO));
    const pago = antes - API.state().san; // o que a barra dele realmente viu, não o que ele pediu

    o.arremessos++; o.ultimoVel = vel; o.ultimoDano = dano;
    if (dano > o.melhor) o.melhor = dano;

    API.roll({
      who: CONF.quem,
      txt: TR_MARCA + ' Orbe em ' + m.nome + ' — velocidade d' + TR_DADO + ' (' + vel + ')' + (errou ? ' · passou direto' : ' × ' + TR_MULT),
      total: dano,
      detalhe: errou ? ('0 de dano · −' + pago + ' de ' + CONF.san.nome) : (dano + ' para o mestre baixar em ' + m.nome + ' · −' + pago + ' de ' + CONF.san.nome),
      classe: errou ? 'fumble' : (vel === TR_DADO ? 'crit' : '')
    });
    publicar(); desenhar();
    saida(errou
      ? '🌀 Velocidade ' + vel + ' — a Orbe chegou tarde e atravessou ' + m.nome + ' sem tocar nele. 0 de dano, ' + pago + ' de ' + CONF.san.nome + ' pagos.'
      : '🌀 Velocidade ' + vel + ' × ' + TR_MULT + ' = ' + dano + ' de dano em ' + m.nome + '. O mestre baixa na aba Inimigos; ' + pago + ' de ' + CONF.san.nome + ' pagos.',
      errou ? 'ruim' : 'bom');
    API.activity(CONF.quem, TR_MARCA + (errou ? ' errou o arremesso' : ' acertou ' + dano + ' em ' + m.nome));
    API.save();
  }

  /* ---------- o arco do Thalles ----------
     Dois botões, duas cobranças: CARREGAR compra poder (cada carga custa Vínculo, até o teto) e
     SOLTER compra a flecha. O dano é o único do grupo que NÃO depende do dado — a mira só decide
     se a flecha chegou. É de propósito: o Trinstan é aposta, o Thalles é decisão. E o que a
     flecha come é vida MÁXIMA, então a conta passa por três travas antes de sair: o que ele
     pediu com as cargas, o que ainda cabe no teto de alma DESTE inimigo, e o que a vida máxima
     dele aguenta perder sem virar zero. A menor das três é a que acontece. */
  function carregar() {
    const a = th(), s = st();
    const travado = bloqueado();
    if (travado) { saida(TH_MARCA + ' ' + atual().nome + ' não arma o arco: ' + travado + '.', 'ruim'); return; }
    if (a.cargas >= TH_CARGAS) { saida(TH_MARCA + ' O arco já está no teto (' + TH_CARGAS + ' cargas). Agora é soltar, ou esperar.', 'ruim'); return; }
    if (s.san < TH_C_CARGA) { saida(TH_MARCA + ' Não sobrou ' + CONF.san.nome + ' para carregar (custa ' + TH_C_CARGA + ' por carga).', 'ruim'); return; }

    const antes = API.state().san;
    API.vital('san', -TH_C_CARGA);
    a.cargas++;
    publicar(); desenhar();
    saida(TH_MARCA + ' Carga ' + a.cargas + '/' + TH_CARGAS + ' na luz do arco. Cobrou ' + (antes - API.state().san) + ' de ' + CONF.san.nome + '.', 'bom');
    API.activity(CONF.quem, TH_MARCA + ' carregou o arco (' + a.cargas + '/' + TH_CARGAS + ')');
    API.save();
  }

  function disparar() {
    const a = th(), s = st();
    const travado = bloqueado();
    if (travado) { saida(TH_MARCA + ' ' + atual().nome + ' não dispara: ' + travado + '.', 'ruim'); return; }
    if (!a.cargas) { saida(TH_MARCA + ' O arco está vazio: carregue antes (' + TH_C_CARGA + ' de ' + CONF.san.nome + ' por carga).', 'ruim'); return; }
    const m = mobPorId(a.alvo);
    if (!m) { saida(TH_MARCA + ' Sem inimigo escolhido na caixinha, a flecha não tem para onde ir.', 'ruim'); return; }
    if (s.san < TH_C_TIRO) { saida(TH_MARCA + ' Não sobrou ' + CONF.san.nome + ' para soltar a flecha (custa ' + TH_C_TIRO + ').', 'ruim'); return; }

    const cargas = a.cargas, mira = API.face(TH_DADO);
    const errou = mira <= TH_ERRA, cheio = !errou && mira === TH_CRIT;
    const dano = errou ? 0 : cargas * TH_DANO;
    const pedida = errou ? 0 : cargas * TH_ALMA * (cheio ? 2 : 1);
    const ferida = almaDe(m.id);
    const M = Math.max(1, Number(m.hpMax) || 1);
    /* A base é o número do MESTRE. Se ele baixou o teto na aba dele, a ficha entende que os cobrados
       já entraram naquele número novo e recomeça a conta a partir dali — sem isso, a mordida antiga
       seria descontada duas vezes (uma no teto que ele escreveu, outra na conta daqui) e o jogador
       veria um teto menor do que o real. Enquanto ele NÃO escreve, é `p` que segura o piso. */
    if (ferida.b !== M) { ferida.b = M; ferida.p = 0; }
    const falta = Math.max(0, TH_ALMA_MAX - ferida.c);
    const tetoVivo = Math.max(1, M - ferida.p);
    const alma = errou ? 0 : Math.min(pedida, falta, tetoVivo - 1);
    const novoTeto = Math.max(1, tetoVivo - alma);

    a.cargas = 0;                       // a luz gasta toda de uma vez: não existe flecha pela metade
    const antes = API.state().san;
    API.vital('san', -(errou ? TH_C_ERRO : TH_C_TIRO));
    const pago = antes - API.state().san;

    a.tiros++; a.ultimaMira = mira; a.ultimoDano = dano; a.ultimaAlma = alma;
    if (dano > a.melhorDano) a.melhorDano = dano;
    if (alma > a.melhorAlma) a.melhorAlma = alma;
    if (alma > 0) { ferida.c = Math.min(TH_ALMA_MAX, ferida.c + alma); ferida.p += alma; }

    API.roll({
      who: CONF.quem,
      txt: TH_MARCA + ' Flecha em ' + m.nome + ' — ' + cargas + ' carga(s), mira d' + TH_DADO + ' (' + mira + ')' + (errou ? ' · se desfez no ar' : (cheio ? ' · em cheio' : '')),
      total: dano,
      detalhe: errou
        ? ('0 de dano · −' + pago + ' de ' + CONF.san.nome + ' · ' + cargas + ' carga(s) perdida(s)')
        : (dano + ' de vida atual' + (alma > 0
            ? (' e −' + alma + ' de vida MÁXIMA (a ficha conta o teto de ' + m.nome + ' em ' + novoTeto + '; baixar na aba é com o mestre)')
            : ' e −0 de vida MÁXIMA (a alma dele já chegou no limite da ficha)') + ' · −' + pago + ' de ' + CONF.san.nome),
      classe: errou ? 'fumble' : (cheio ? 'crit' : '')
    });
    publicar(); desenhar();
    saida(errou
      ? TH_MARCA + ' Mira ' + mira + ' — a flecha se desfez no ar antes de tocar ' + m.nome + '. As ' + cargas + ' carga(s) foram perdidas e ainda cobrou ' + pago + ' de ' + CONF.san.nome + '.'
      : (alma > 0
        ? TH_MARCA + ' Mira ' + mira + (cheio ? ' — EM CHEIO' : '') + ': ' + cargas + ' carga(s) = ' + dano + ' de dano em ' + m.nome + ', e a alma perde ' + alma + ' de vida máxima: na conta da ficha o teto dele cai de ' + tetoVivo + ' para ' + novoTeto + ' (quem baixa na aba é o mestre).' + (pedida > alma ? ' Ele só podia perder mais ' + falta + ', então a mordida veio menor do que o pedido.' : '') + ' Cobrou ' + pago + ' de ' + CONF.san.nome + '.'
        : TH_MARCA + ' Mira ' + mira + ': ' + cargas + ' carga(s) = ' + dano + ' de dano em ' + m.nome + ', mas a flecha não arranca mais vida máxima nenhuma — a alma dele já chegou no limite que a ficha permite (' + TH_ALMA_MAX + ' por inimigo) ou o teto já está no piso de 1. Só a vida atual sofreu, e cobrou ' + pago + ' de ' + CONF.san.nome + '.'),
      errou ? 'ruim' : 'bom');
    API.activity(CONF.quem, TH_MARCA + (errou ? ' errou o disparo' : ' feriu ' + m.nome + ' (' + dano + ' e −' + alma + ' de alma)'));
    API.save();
  }

  function desenharOrbe(bloco) {
    const o = tt();
    const bichos = mobs();

    const linha = el('div', 'pers-alvo');
    linha.appendChild(el('label', null, 'Quem a Orbe vai acertar:'));
    const sel = el('select'); sel.id = 'orbAlvo';
    const vazioOp = el('option', null, bichos.length
      ? '— sem mira (a Orbe está girando na mão dele) —'
      : '— o mestre ainda não pôs ninguém em cena —');
    vazioOp.value = '';
    if (!bichos.length) vazioOp.disabled = true;
    sel.appendChild(vazioOp);
    bichos.forEach(function (m) {
      const opt = el('option', null, '⚔ ' + (m.nome || 'Inimigo sem nome') + ' · ' + m.hp + '/' + m.hpMax);
      opt.value = String(m.id);
      if (m.hp === 0) opt.disabled = true; // caído não leva orbe
      sel.appendChild(opt);
    });
    sel.value = o.alvo ? String(o.alvo) : '';
    sel.addEventListener('change', function () {
      const oo = tt();
      oo.alvo = mobPorId(sel.value) ? String(sel.value) : null;
      publicar(); desenhar();
      const m = mobPorId(oo.alvo);
      API.activity(CONF.quem, m ? TR_MARCA + ' mira em ' + m.nome : TR_MARCA + ' baixou a mira');
      saida(m
        ? '🌀 A Orbe está apontada em ' + m.nome + '. Agora é apertar e ver a velocidade que sai.'
        : '🌀 Sem mira. A Orbe gira na mão dele, esperando.', 'bom');
    });
    linha.appendChild(sel);
    const m0 = mobPorId(o.alvo);
    const estado = el('span', 'pers-estado');
    estado.textContent = (m0 ? 'mira em ' + m0.nome : 'orbe na mão') + ' · arremessos: ' + o.arremessos +
      ' · melhor: ' + o.melhor + (o.ultimoVel ? ' · último: ' + o.ultimoVel + ' → ' + o.ultimoDano : '');
    linha.appendChild(estado);
    bloco.appendChild(linha);

    const acoes = el('div', 'orb-acoes');
    const btn = el('button', 'orb-btn', TR_MARCA + ' Arremessar a Orbe');
    btn.type = 'button'; btn.id = 'orbThrow';
    btn.title = 'sorteia a velocidade (d' + TR_DADO + ') e mostra o dano — quem baixa a vida do inimigo é o mestre';
    btn.addEventListener('click', arremessar);
    acoes.appendChild(btn);
    const conta = el('span', 'orb-conta', 'dano = velocidade × ' + TR_MULT + ' · custa ' + TR_CUSTO + ' de ' + CONF.san.nome + ' por arremesso');
    acoes.appendChild(conta);
    bloco.appendChild(acoes);

    const resultado = el('p', 'pers-result'); resultado.id = 'persResult';
    bloco.appendChild(resultado);

    const oque = el('ul', 'pers-regras');
    [
      'A velocidade é <b>sorteada</b>: um <b>d' + TR_DADO + '</b> puro. O dano é ela <b>× ' + TR_MULT + '</b> — nem o atributo dele, nem os efeitos (os bons <b>e</b> os do mestre) entram nessa conta. A Orbe obedece à velocidade, não a humor.',
      'Até <b>' + TR_PASSA + '</b> a Orbe <b>passa direto</b>: chegou devagar demais e atravessou o alvo. <b>0 de dano</b> e <b>' + TR_CUSTO_ERRO + ' de ' + CONF.san.nome + '</b> cobrados — errar também custa.',
      'Quem baixa a vida do inimigo é o <b>mestre</b>, na aba Inimigos dele. A Orbe escreve o número no histórico compartilhado e para aí: ela não toca no bestiário nem em ficha de ninguém.',
      'Precisa ter <b>inimigo em cena</b> escolhido na caixinha e <b>Vínculo para pagar</b> (' + TR_CUSTO + ' por arremesso). Com ☠️ Apagada ou 🟡 Vacilando no corpo, a razão não sustenta a Orbe.',
      'Trocar de personalidade <b>não desfaz nada aqui</b>: a Orbe é dele, não de um humor — o que muda é que só com o Trinstan no comando ela sai da mão.'
    ].forEach(function (txt) {
      const li = el('li'); li.innerHTML = txt; oque.appendChild(li);
    });
    bloco.appendChild(oque);

    const tut = el('details', 'story-block orb-tut'); tut.id = 'orbTutorial';
    const sum = el('summary'); sum.textContent = TR_MARCA + ' Como usar a Orbe na mesa, com um exemplo';
    tut.appendChild(sum);
    tut.appendChild(el('p', 'story-text',
      'É o único poder do grupo que <b>bate de volta</b>: o mestre põe o bicho na aba Inimigos, ele escolhe o bicho na caixinha acima, aperta, e o número aparece para todo mundo. '
      + '<br><br><b>Exemplo:</b> "A Voz Antiga" está em cena com 40 de vida. Sai <b>8</b> no d' + TR_DADO + ' → 8 × ' + TR_MULT + ' = <b>' + (8 * TR_MULT) + ' de dano</b>, que cai no histórico como rolagem dele, e a Vínculo dele desce ' + TR_CUSTO + '. O mestre baixa os ' + (8 * TR_MULT) + ' na vida do bicho.'
      + '<br><br><b>Se saísse 2:</b> a Orbe passou direto — nada de dano, ' + TR_CUSTO_ERRO + ' de Vínculo cobrados, e o erro aparece escrito no histórico compartilhado. Esconder erro é a pior coisa numa ficha que o mestre lê junto.'
      + '<br><br><b>O que a Orbe não é:</b> não é teste de atributo (não soma os chips dela), não cura ninguém, não acerta aliado, e não baixa a vida sozinha.'));
    tut.open = !!o.tutAberto;
    tut.addEventListener('toggle', function () {
      const oo = tt();
      if (oo.tutAberto === tut.open) return;
      oo.tutAberto = tut.open;
      API.save();
    });
    bloco.appendChild(tut);
  }

  function desenharArco(bloco) {
    const a = th();
    const bichos = mobs();

    const linha = el('div', 'pers-alvo');
    linha.appendChild(el('label', null, 'Quem a flecha vai buscar:'));
    const sel = el('select'); sel.id = 'arcoAlvo';
    const vazioOp = el('option', null, bichos.length
      ? '— sem mira (o arco está por conjurar) —'
      : '— o mestre ainda não pôs ninguém em cena —');
    vazioOp.value = '';
    if (!bichos.length) vazioOp.disabled = true;
    sel.appendChild(vazioOp);
    bichos.forEach(function (m) {
      const ferida = almaPerdida(m.id);
      const opt = el('option', null, '⚔ ' + (m.nome || 'Inimigo sem nome') + ' · ' + m.hp + '/' + m.hpMax +
        (ferida ? ' · alma −' + ferida + '/' + TH_ALMA_MAX : ''));
      opt.value = String(m.id);
      if (m.hp === 0) opt.disabled = true; // caído não leva flecha
      sel.appendChild(opt);
    });
    sel.value = a.alvo ? String(a.alvo) : '';
    sel.addEventListener('change', function () {
      const aa = th();
      aa.alvo = mobPorId(sel.value) ? String(sel.value) : null;
      publicar(); desenhar();
      const m = mobPorId(aa.alvo);
      API.activity(CONF.quem, m ? TH_MARCA + ' mira em ' + m.nome : TH_MARCA + ' baixou o arco');
      saida(m
        ? '🏹 A mira está em ' + m.nome + '. Carregue e solte: a flecha sai com o que o arco tiver guardado.'
        : '🏹 Sem alvo. O arco fica na mão dele, sem rumo.', 'bom');
    });
    linha.appendChild(sel);
    const m0 = mobPorId(a.alvo);
    const estado = el('span', 'pers-estado');
    estado.textContent = (m0 ? 'mira em ' + m0.nome : 'sem mira') + ' · cargas: ' + a.cargas + '/' + TH_CARGAS +
      ' · flechas soltas: ' + a.tiros +
      (a.ultimaMira ? ' · última: ' + a.ultimoDano + ' de dano e −' + a.ultimaAlma + ' de alma' : '');
    linha.appendChild(estado);
    bloco.appendChild(linha);

    /* O medidor existe porque "carregado" precisa ser VISÍVEL: sem os pips, o jogador aperta o
       botão sem saber quanto poder está guardado na corda — e a decisão de soltar é o poder dele. */
    const medidor = el('div', 'arco-cargas');
    medidor.appendChild(el('span', 'arco-rotulo', 'O arco'));
    for (let i = 1; i <= TH_CARGAS; i++) {
      const pip = el('span', 'arco-pip' + (i <= a.cargas ? ' cheia' : ''));
      pip.title = 'carga ' + i + ' de ' + TH_CARGAS;
      medidor.appendChild(pip);
    }
    medidor.appendChild(el('span', 'arco-total', a.cargas
      ? 'guarda ' + (a.cargas * TH_DANO) + ' de dano e −' + (a.cargas * TH_ALMA) + ' de alma (−' + (a.cargas * TH_ALMA * 2) + ' se a mira sair ' + TH_CRIT + ')'
      : 'está vazio'));
    bloco.appendChild(medidor);

    const acoes = el('div', 'arco-acoes');
    const b1 = el('button', 'arco-btn arco-carregar', TH_MARCA + ' Carregar a luz');
    b1.type = 'button'; b1.id = 'arcoLoad';
    b1.title = 'puxa 1 carga de luz: custa ' + TH_C_CARGA + ' de ' + CONF.san.nome;
    b1.addEventListener('click', carregar);
    const b2 = el('button', 'arco-btn arco-soltar', TH_MARCA + ' Soltar a flecha');
    b2.type = 'button'; b2.id = 'arcoShoot';
    b2.title = 'gasta todas as cargas no alvo: ' + TH_DANO + ' de dano e −' + TH_ALMA + ' de vida máxima por carga';
    b2.addEventListener('click', disparar);
    acoes.appendChild(b1); acoes.appendChild(b2);
    acoes.appendChild(el('span', 'arco-conta', 'carregar custa ' + TH_C_CARGA + ' de ' + CONF.san.nome + ' por carga · soltar custa ' + TH_C_TIRO + ' · mira até ' + TH_ERRA + ' se desfaz no ar e leva as cargas embora'));
    bloco.appendChild(acoes);

    const resultado = el('p', 'pers-result'); resultado.id = 'persResult';
    bloco.appendChild(resultado);

    const oque = el('ul', 'pers-regras');
    [
      'O dano <b>não é sorteado</b>: são <b>' + TH_DANO + ' por carga</b>, e cada carga é comprada com <b>' + TH_C_CARGA + ' de ' + CONF.san.nome + '</b>. O dado só decide se a flecha <b>chega</b> — o Trinstan é aposta, o Thalles é decisão.',
      'Mira até <b>' + TH_ERRA + '</b>: a flecha <b>se desfaz no ar</b>. Nada de dano, as cargas vão embora com ela e ainda cobra <b>' + TH_C_ERRO + ' de ' + CONF.san.nome + '</b>. Sair <b>' + TH_CRIT + '</b> é <b>em cheio</b>: a mordida na alma dobra.',
      'O que o arco come é <b>vida MÁXIMA</b> (' + TH_ALMA + ' por carga): o alvo fica com o teto menor <b>para sempre</b>. Um mesmo inimigo só pode perder <b>' + TH_ALMA_MAX + '</b> de vida máxima no total, e o teto dele <b>nunca cai abaixo de 1</b> — a alma some, o bicho não vira pó.',
      'Quem baixa o número é o <b>mestre</b>, na aba Inimigos dele. A flecha escreve a conta no histórico compartilhado ("o teto vai de 40 para 37") e para aí: ferir alma de outra criatura não é coisa que uma ficha faça sozinha.',
      'As cargas <b>ficam</b> se ele sair de cena e voltar — ele pagou por elas. O que a troca muda é só quem está segurando o arco.'
    ].forEach(function (txt) {
      const li = el('li'); li.innerHTML = txt; oque.appendChild(li);
    });
    bloco.appendChild(oque);

    const tut = el('details', 'story-block arco-tut'); tut.id = 'arcoTutorial';
    const sum = el('summary'); sum.textContent = TH_MARCA + ' Como usar o Arco de Luz na mesa, com um exemplo';
    tut.appendChild(sum);
    tut.appendChild(el('p', 'story-text',
      'É o poder <b>de duas mãos</b>: primeiro ele puxa a luz (um clique por carga, até ' + TH_CARGAS + '), depois escolhe o bicho na caixinha e solta. Nada disso é automático — a força da flecha é o quanto ele aceitou pagar antes. '
      + '<br><br><b>Exemplo:</b> "A Voz Antiga" está em cena com 40 de vida máxima. Ele carrega <b>3</b> (3 de ' + CONF.san.nome + ') e dispara. Sai <b>6</b> na mira: saem <b>' + (3 * TH_DANO) + '</b> de dano na vida atual e a alma perde <b>' + (3 * TH_ALMA) + '</b> — o mestre baixa o teto de 40 para <b>' + (40 - 3 * TH_ALMA) + '</b>. Se na seguinte sair <b>' + TH_CRIT + '</b> (em cheio), a mordida dobra: <b>' + (3 * TH_ALMA * 2) + '</b> de uma vez.'
      + '<br><br><b>Se saísse 2:</b> a flecha se desfez no ar — os ' + (3 * TH_DANO) + ' de dano não existem, as 3 cargas foram jogadas fora e ainda cobra ' + TH_C_ERRO + ' de ' + CONF.san.nome + '. É o único poder do grupo que pode perder o que já pagou.'
      + '<br><br><b>O teto de alma (' + TH_ALMA_MAX + ' por inimigo):</b> na terceira flecha cheia ele já mordeu ' + TH_ALMA_MAX + ' daquele bicho, então a mira passa a valer só como dano normal. Não existe "farmar" a alma de um chefe até ela sumir do mapa — e isso é decisão de balanceamento, mora em CONF.thalles.'));
    tut.open = !!a.tutAberto;
    tut.addEventListener('toggle', function () {
      const aa = th();
      if (aa.tutAberto === tut.open) return;
      aa.tutAberto = tut.open;
      API.save();
    });
    bloco.appendChild(tut);
  }

  function desenharStrip() {
    if (!strip) return;
    const s = st();
    strip.innerHTML = '';
    strip.appendChild(el('span', 'pers-rotulo', '🎭 Personalidade'));
    CONF.personalidades.forEach(function (p, i) {
      const b = el('button', 'pers-btn' + (p.id === s.pers ? ' ativa' : '') + (p.vaga ? ' vaga' : ''));
      b.type = 'button';
      b.textContent = p.vaga ? '☐ vaga ' + (i + 1) : (p.emoji || '') + ' ' + (p.nome || 'sem nome');
      b.title = p.vaga ? 'o mestre ainda vai escrever esta personalidade' : 'assumir ' + p.nome;
      if (p.vaga) b.disabled = true;
      else b.addEventListener('click', function () { trocar(p.id); });
      strip.appendChild(b);
    });
    const nota = el('span', 'pers-nota');
    nota.textContent = 'Brasa e Vínculo são do corpo — o que muda é o resto.';
    strip.appendChild(nota);
  }

  function desenharPoder() {
    if (!host) return;
    const s = st(), p = atual(), t = ts();
    host.innerHTML = '';

    if (!p) return;
    if (p.vaga || !p.oQueFaz) {
      const vazio = el('div', 'pers-vazio');
      vazio.appendChild(el('p', 'm-block-title', '☐ ' + (p.nome || 'Personalidade ' + p.id)));
      vazio.appendChild(el('p', 'story-text', 'Esta personalidade ainda não foi escrita pelo mestre. O botão existe pra ele poder trocar quando chegar a vez dela — e o poder entrar aqui, no mesmo lugar em que o da Tessalha entrou.'));
      host.appendChild(vazio);
      return;
    }

    const bloco = el('div', 'pers-bloco');
    bloco.appendChild(el('p', 'm-block-title', (p.emoji || '') + ' ' + p.nome + ' — ' + (p.oQueE || '')));
    /* A explicação em português corrido, antes de qualquer botão: é o que ele pediu nas
       outras fichas — nada de linguagem de planilha pra dizer o que o poder faz. */
    bloco.appendChild(el('p', 'pers-faz', p.oQueFaz));
    if (p.oQueCusta) bloco.appendChild(el('p', 'pers-custa', 'O que custa: ' + p.oQueCusta));

    /* Cada personalidade desenha o próprio bloco embaixo da explicação. O da Tessalha é a
       caixinha de quem ela escuta; o do Trinstan é a mira e o gatilho da Orbe. */
    if (p.id === 'trinstan') {
      desenharOrbe(bloco);
      host.appendChild(bloco);
      return;
    }
    if (p.id === 'thalles') {
      desenharArco(bloco);
      host.appendChild(bloco);
      return;
    }

    /* --- quem ela escuta --- */
    const linha = el('div', 'pers-alvo');
    linha.appendChild(el('label', null, 'De quem a aura recebe o bem agora:'));
    const sel = el('select'); sel.id = 'persAlvo';
    const vazioOp = el('option', null, '— ninguém (a aura está parada) —'); vazioOp.value = '';
    sel.appendChild(vazioOp);
    ALVOS.forEach(function (a) {
      const o = el('option', null, a.emoji + ' ' + a.nome); o.value = a.chave;
      sel.appendChild(o);
    });
    sel.value = t.alvo || '';
    sel.addEventListener('change', function () {
      const tt = ts();
      tt.alvo = alvoCfg(sel.value) ? sel.value : null;
      ressincronizar();
      publicar(); desenhar();
      const a = alvoCfg(tt.alvo);
      API.activity(CONF.quem, a ? MARK + ' escolheu ' + a.nome : MARK + ' soltou todo mundo');
      saida(a
        ? '🌿 A aura está em ' + a.nome + '. Tudo que for bom pra ela dele cai nela a partir de agora — ela não precisa fazer nada, nem rolar nada.'
        : '🌿 Sem ninguém escolhido, a aura não escuta nada. Nada é ecoado.', 'bom');
    });
    linha.appendChild(sel);
    const a = alvoCfg(t.alvo);
    const estado = el('span', 'pers-estado');
    estado.textContent = a
      ? 'escutando ' + a.nome + ' · empréstimos: ' + ecoAtivos().length + '/' + ECO_MAX
      : 'aura parada';
    linha.appendChild(estado);
    bloco.appendChild(linha);

    /* --- o resultado das coisas que chegaram --- */
    const resultado = el('p', 'pers-result'); resultado.id = 'persResult';
    bloco.appendChild(resultado);

    const oque = el('ul', 'pers-regras');
    [
      'Só o bem atravessa: <b>cura</b> (Brasa/Vínculo subindo) e <b>buff</b> que termina em <b>· +N</b>. Dano, maldição e <b>· −N</b> não chegam nela — a aura empresta sorte, não dor.',
      'Cada empréstimo vira um chip <b>' + MARK_TXT + ' eco de Nome · +N</b> nos efeitos dela, com o <b>mesmo teto de ±3</b> de qualquer marca, e entra nas rolagens dela enquanto durar.',
      'Só cabem <b>' + ECO_MAX + '</b> empréstimos. O terceiro chega e desfaz o mais velho. Os outros 4 espaços de efeito são dela e do mestre.',
      'Ela <b>nunca escreve na ficha do aliado</b> — é leitura pura. Se a pessoa tirar o próprio buff, o eco dela fica (já caiu); se ela quiser, tira clicando no chip.',
      'Trocar de personalidade <b>desfaz os empréstimos</b>: a aura vai embora junto com a Tessalha. O que o mestre marcou (☠️/🟡) não vai.'
    ].forEach(function (txt) {
      const li = el('li'); li.innerHTML = txt; oque.appendChild(li);
    });
    bloco.appendChild(oque);

    /* --- tutorial dobrável, lembrando se ela quer ele aberto (repetindo o do lampião) --- */
    const tut = el('details', 'story-block pers-tut'); tut.id = 'persTutorial';
    const sum = el('summary'); sum.textContent = MARK + ' Como usar a Tessalha na mesa, com um exemplo';
    tut.appendChild(sum);
    tut.appendChild(el('p', 'story-text',
      'É um poder que não se aciona, se <b>deixa ligado</b>: escolhe a pessoa na caixinha acima e pronto — a partir daí ela só reage. ' +
      '<br><br><b>Exemplo 1:</b> a Flora está 12/30 de vida e o mestre alimenta +6 na ficha da Flora. Na tela da Tessalha aparece, sozinha, a linha "🌿 +6 de Brasa", a barra dela sobe os mesmos 6 (respeitando o teto de 26) e o histórico compartilhado registra que foi eco — não rolagem dela. ' +
      '<br><br><b>Exemplo 2:</b> o Dante vira A Estrela pra Clara e manda "✨ Abençoada · +2". A Tessalha ganha "🌿 eco de Clara · +2", que vale nas rolagens dela igualzinho vale nas da Clara, até ela trocar de personalidade ou clicar no chip pra jogar fora. ' +
      '<br><br><b>O que NÃO chega nela:</b> o "🟡 Vacilando" que o mestre põe na Tessalha, o −3 que ele manda na Flora, um ☠️ em qualquer um. E se a pessoa escolhida curar 40 enquanto ela está em 24/26, ela sobe até 26 e a linha diz "+2" — o número que a barra dela realmente viu.'));
    tut.open = !!t.tutAberto;
    tut.addEventListener('toggle', function () {
      const tt = ts();
      if (tt.tutAberto === tut.open) return;
      tt.tutAberto = tut.open;
      API.save();
    });
    bloco.appendChild(tut);

    host.appendChild(bloco);
  }

  function desenhar() { desenharStrip(); desenharAttrs(); desenharPoder(); }

  /* ---------- ligações ---------- */
  ts(); // normaliza o estado (e escolhe a primeira personalidade que existe, se preciso)
  attrsSetup(); // a estreia dos cinco números por personalidade: cria os arquivos uma vez e não toca mais no que já foi salvo
  document.body.setAttribute('data-pers', st().pers || '');
  if (tessalhaLigada()) ressincronizar();
  publicar();
  desenhar();

  /* O ouvido: outra aba (a ficha do aliado, ou o painel do mestre editando o aliado) escreveu
     na chave daquela pessoa → compara, aplica o que subiu. O próprio salvamento dela não gera
     evento em si mesma, então não existe eco de eco nem looping. */
  global.addEventListener('storage', function (e) {
    if (e.key === MOB_KEY) { // o mestre mexeu na cena: a mira da Orbe e a do arco são outra lista agora
      if (trinstanLigada() || thallesLigada()) { publicar(); desenhar(); }
      return;
    }
    if (e.key === CONF.chave) { // o mestre editou um número dela noutra aba: a tabela da aba
      desenharAttrs();          // Status precisa mostrar o mesmo valor que a rolagem passou a somar
      return;
    }
    const t = ts();
    if (!t.alvo || e.key !== t.alvo) return;
    const a = alvoCfg(t.alvo);
    if (!a) return;
    let novo = null;
    try { novo = JSON.parse(e.newValue || 'null'); } catch (err) { novo = null; }
    receber(novo, a);
  });

  global.__VESPER_OK = true; // o banner da página usa isto pra avisar se o bloco não veio
})(window);
