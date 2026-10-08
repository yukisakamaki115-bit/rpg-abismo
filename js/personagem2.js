/* ===== Ficha do Nox — criatura de muitas peles (lógica local, sem Firebase) ===== */
(function () {
  'use strict';

  const SAVE_KEY = 'eclipse_coelho_v1';
  const PORTRAIT_KEY = SAVE_KEY + '_portrait';
  const STORY_KEY = SAVE_KEY + '_story';
  const WHO = 'Nox'; // identidade nas rolagens/atividade compartilhadas

  // Chaves GLOBAIS compartilhadas com as outras fichas + mestre
  const ROLL_KEY = 'eclipse_roll_log';
  const ROLL_MAX = 60;
  const ACT_KEY = 'eclipse_activity';
  const ACT_MAX = 120;

  // ---------- Estado padrão ----------
  // Os 5 atributos têm o MESMO nome nas 3 fichas (só os valores mudam) —
  // senão na hora do mestre pedir "faz um teste de..." vira bagunça.
  const ATTR_NOMES = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', carisma: 'Carisma' };

  // ---------- Magia de espaço: os 7 círculos (catálogo fixo — não é editável como os poderes) ----------
  // `somaEm` é onde o bônus do círculo entra na conta: nomes de atributo, ou 'dano' (rolagem de arma).
  // `reserva` é o que ele declara pro mestre (resistência / absorção / passagem) — não soma em rolagem nenhuma.
  // `mundoReal: true` = o único que acorda fora do Outro Mundo.
  const CIRCULOS = [
    { id: 'vharak', nome: 'Vharak', titulo: 'Círculo da Força', base: 3, somaEm: ['forca', 'dano'],
      cantico: 'Vharak, desperta a força que repousa sob a matéria.',
      efeito: 'Aumenta direto a força aplicada por ele, por outra criatura ou por um objeto — em golpe, arma, projétil ou parte do corpo.',
      naoFaz: 'não dá velocidade, resistência nem percepção por conta própria.' },
    { id: 'syran', nome: 'Syran', titulo: 'Círculo da Velocidade', base: 3, somaEm: ['destreza', 'dano'],
      cantico: 'Syran, rompe o limite entre o instante e o movimento.',
      efeito: 'Aumenta velocidade, aceleração e agilidade de corpos, objetos ou ataques — e o impacto que essa velocidade realmente produzir.',
      naoFaz: 'não endurece o corpo: com Syran aberto e Tharun fechado, cada uso cobra 🧵 2 de linha dele.' },
    { id: 'tharun', nome: 'Tharun', titulo: 'Círculo da Resistência', base: 3, somaEm: ['constituicao'], reserva: 'resistencia',
      cantico: 'Tharun, torna a matéria firme contra aquilo que deseja quebrá-la.',
      efeito: 'Firmeza física e estrutural dele, de outra criatura, de um objeto ou de uma parte específica do corpo.',
      naoFaz: 'não aumenta força, velocidade nem dano — serve pra ele aguentar impactos e acelerações que destruiriam a estrutura.' },
    { id: 'aeryn', nome: 'Aeryn', titulo: 'Círculo da Percepção', base: 3, somaEm: ['inteligencia', 'carisma'],
      cantico: 'Aeryn, abre meus sentidos para tudo aquilo que existe além do olhar.',
      efeito: 'Abre visão, audição, noção de espaço, detecção de movimento, de energia e de fenômenos mágicos — incluindo as frestas entre mundos.',
      naoFaz: 'não empurra força nem resistência; deixa ele perceber e reagir ao que seria rápido demais.' },
    { id: 'kaelith', nome: 'Kaelith', titulo: 'Círculo do Controle', base: 3, somaEm: ['destreza', 'dano'],
      cantico: 'Kaelith, curva o caminho e submete o movimento à minha vontade.',
      efeito: 'Alterar, segurar e redirecionar movimentos e trajetórias de corpos, objetos e ataques.',
      naoFaz: 'não cria força nem velocidade do nada — só manda no movimento que já existe.' },
    { id: 'elyr', nome: 'Elyr', titulo: 'Círculo da Absorção', base: 3, somaEm: [], reserva: 'absorcao',
      cantico: 'Elyr, recebe aquilo que me alcança e silencia sua força.',
      efeito: 'Recebe e silencia parte da energia, da força ou do impacto que alcança ele, outra criatura ou um objeto.',
      naoFaz: 'não endurece o corpo nem apaga o ataque inteiro — só segura um pedaço da energia que chega.' },
    { id: 'vaelnor', nome: "Vael'Nor", titulo: 'Círculo das Passagens', base: 2, somaEm: [], reserva: 'passagem', mundoReal: true,
      cantico: "Vael'Nor, abre a passagem onde não existe caminho.",
      efeito: "Cria e manipula passagens entre pontos do espaço e entre mundos: ele some, reaparece, atravessa obstáculo, ou faz objeto e ataque atravessarem uma fresta. No Mundo Real ninguém vê a passagem — só o desaparecimento.",
      naoFaz: 'não tem dano nem bônus de impacto próprio: controla a passagem, não a força do que passa por ela.' }
  ];
  // As travas de balanceamento — é aqui que o "+5 por aplicação" para de ser quase hit-kill.
  const CIR_CURVA = [5, 3, 2];        // 1ª camada +5, a 2ª soma +3, a 3ª soma +2 → acumulado 5 / 8 / 10 (cada camada rende MENOS que a anterior)
  const CIR_MAX_POR_CIRCULO = 2;      // camadas sobrepostas no mesmo círculo
  const CIR_MAX_NO_PALCO = 3;         // camadas abertas no palco, somando todos os círculos
  const CIR_TETO = 10;                // teto de bônus mágico numa única rolagem — o que passar disso não entra na conta
  const CIR_USOS = 3;                 // círculo aberto segura 3 rolagens benéficas e se desfaz
  const CIR_CUSTO_CRESC = [0, 2, 4];  // a 2ª camada custa +2 por cima da base, a 3ª +4
  const CIR_SYRAN_SEM_THARUN = 2;     // velocidade sem resistência cobra o corpo dele

  const defaultState = {
    hp: 24, hpMax: 24,        // Enchimento
    san: 100, sanMax: 100,    // Linha
    mundo: 'real',            // 'real' | 'outro'
    forma: 'coelho',          // 'coelho' | 'lobo' (só no Mundo Real; no Outro é a Forma Verdadeira)
    status: [],
    armas: [],
    log: [],
    obsessao: { nome: 'Colecionador de Botões', desc: '' },
    atributos: {
      /* Todos em 1 desde 06/10 — a regra de criação da mesa (base 1, até 4 pontos por atributo,
         10 para distribuir). Os números velhos (8/16/11/15/13) eram escolha minha. */
      forca:        { nome: 'Força',        valor: 1 },
      destreza:     { nome: 'Destreza',     valor: 1 },
      constituicao: { nome: 'Constituição', valor: 1 },
      inteligencia: { nome: 'Inteligência', valor: 1 },
      carisma:      { nome: 'Carisma',      valor: 1 }
    },
    // Cada poder cobra 🧵 Linha (a sanidade dele) — o mesmo jeito das cartas do Dante cobrarem 🕯 Vontade.
    // O id é o que segura a migração: o nome é editável na ficha, então quem renomeia não recebe cópia do poder.
    poderes: [
      { id: 'costura', nome: 'Costura de Botão', tipo: 'Ataque · Controle', atributo: 'inteligencia', rolar: true, custo: 2,
        desc: 'Agulhas e linha surgem do nada: ele cose, prende e fere — e pode selar os olhos do alvo com botões.' },
      { id: 'porta', nome: 'Passo da Porta', tipo: 'Mobilidade · Esquiva', atributo: 'destreza', rolar: true, custo: 1,
        desc: 'Reconhece portas que não deviam existir e atravessa: some de um lado, reaparece do outro.' },
      { id: 'fio', nome: 'Fio Esticado', tipo: 'Armadilha', atributo: 'inteligencia', rolar: true, custo: 2,
        desc: 'Arma um fio quase invisível que derruba, prende ou despedaça quem passa.' },
      { id: 'patada', nome: 'Patada de Pano', tipo: 'Ataque pesado', atributo: 'forca', rolar: true, custo: 1,
        desc: 'Parece fofura de pelúcia — mas pesa como pedra, e acerta no ritmo do Outro Mundo.' },
      { id: 'olho', nome: 'Olho de Botão', tipo: 'Percepção · Encanto', atributo: 'carisma', rolar: true, custo: 2,
        desc: 'Vê o que se esconde — mentiras, fantasmas, passagens. E às vezes o que ele vê, vê de volta.' },
      { id: 'pele', nome: 'Troca de Pele', tipo: 'Fuga · Sobrevivência', atributo: 'constituicao', rolar: true, custo: 3,
        desc: 'Quando algo o agarra, corta ou prende, ele larga a pele ali e sai por baixo: quem segurava fica segurando um casaco vazio. A pele perdida volta — mas demora, e cobra linha.' },
      { id: 'marionete', nome: 'Marionete de Fio', tipo: 'Controle · Precisão', atributo: 'destreza', rolar: true, custo: 3,
        desc: 'Fios saem dos dedos dele e emendam nos de quem está por perto: por alguns instantes ele move corpo dos outros como boneco. Cada fio emendado é linha que sai do próprio corpo.' }
    ],
    // Círculos abertos agora mesmo: [{ id, camadas, usos }]. O catálogo fixo mora em CIRCULOS.
    // De propósito NÃO vive dentro de `status`: qualquer "· +N" ali dentro o chipValue() soma em
    // TODAS as rolagens, e círculo bom é justamente o que só entra na conta que lhe diz respeito.
    circulos: []
  };

  let state = load();
  /* A regra dos 10 pontos também vale para quem já tinha ficha salva (o estado gravado vence o
     padrão do arquivo). Zera uma vez, marca `state.atrRegra`, e nunca mais toca na distribuição. */
  if (window.ECLIPSE_ATR && ECLIPSE_ATR.regra(state)) save();
  // migração silenciosa: já grava os nomes canônicos dos atributos (os valores são os do jogador)
  if (localStorage.getItem(SAVE_KEY)) save();

  function load() {
    let merged;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      merged = raw ? Object.assign(JSON.parse(JSON.stringify(defaultState)), JSON.parse(raw)) : JSON.parse(JSON.stringify(defaultState));
    } catch (e) { merged = JSON.parse(JSON.stringify(defaultState)); }
    if (typeof merged.hp !== 'number') merged.hp = defaultState.hp;
    if (typeof merged.hpMax !== 'number') merged.hpMax = defaultState.hpMax;
    if (typeof merged.san !== 'number') merged.san = defaultState.san;
    if (typeof merged.sanMax !== 'number') merged.sanMax = defaultState.sanMax;
    if (merged.mundo !== 'real' && merged.mundo !== 'outro') merged.mundo = 'real';
    if (merged.forma !== 'coelho' && merged.forma !== 'lobo') merged.forma = 'coelho';
    if (!Array.isArray(merged.status)) merged.status = [];
    if (!Array.isArray(merged.armas)) merged.armas = [];
    if (!merged.obsessao || typeof merged.obsessao !== 'object') merged.obsessao = { nome: defaultState.obsessao.nome, desc: '' };
    if (!Array.isArray(merged.poderes) || !merged.poderes.length) merged.poderes = JSON.parse(JSON.stringify(defaultState.poderes));
    normPoderes(merged.poderes);
    if (!Array.isArray(merged.circulos)) merged.circulos = [];
    normCirculos(merged.circulos);
    if (!merged.atributos || typeof merged.atributos !== 'object') merged.atributos = JSON.parse(JSON.stringify(defaultState.atributos));
    normAttrs(merged.atributos);
    return merged;
  }
  // força a etiqueta canônica nos 5 atributos (mantém o valor que o jogador já tinha)
  function normAttrs(a) {
    Object.keys(ATTR_NOMES).forEach(function (k) {
      if (!a[k] || typeof a[k].valor !== 'number') a[k] = { nome: ATTR_NOMES[k], valor: defaultState.atributos[k].valor };
      a[k].nome = ATTR_NOMES[k];
    });
    return a;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

  // Poderes: o que ele editou fica na mão dele; o que é novidade no padrão chega por cima.
  // Assim os 2 poderes novos e o custo em Linha aparecem numa ficha que já está salva, sem apagar nada.
  function normPoderes(lista) {
    defaultState.poderes.forEach(function (base) {
      let meu = null;
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i]; if (!p) continue;
        if (p.id === base.id || String(p.nome || '').trim().toLowerCase() === base.nome.trim().toLowerCase()) { meu = p; break; }
      }
      if (!meu) { lista.push(JSON.parse(JSON.stringify(base))); return; }
      if (!meu.id) meu.id = base.id;                                  // carimba o id pra próxima leitura não duplicar
      if (typeof meu.custo !== 'number') meu.custo = base.custo;        // custo que chegou depois
      if (!meu.tipo) meu.tipo = base.tipo;
      if (!meu.atributo) meu.atributo = base.atributo;
    });
    lista.forEach(function (p) { if (p && typeof p.custo !== 'number') p.custo = 0; }); // poder inventado por ele custa 0 se ele não escrever
    return lista;
  }
  // quanto o poder cobra de Linha (número ou texto do editor) — 0 é livre
  function custoOf(p) { const c = parseInt(p && p.custo, 10); return isNaN(c) || c < 0 ? 0 : c; }

  // ---------- Círculos: conta, travas e traçado ----------
  function defCirc(id) { for (let i = 0; i < CIRCULOS.length; i++) { if (CIRCULOS[i].id === id) return CIRCULOS[i]; } return null; }
  function achaCirc(id) { for (let i = 0; i < state.circulos.length; i++) { if (state.circulos[i].id === id) return state.circulos[i]; } return null; }
  // leitura defensiva: id desconhecido fora, camadas/usos sempre números dentro do teto, um registro por círculo.
  // Cuidado: isso roda DENTRO de load(), com `state` ainda sem existir — nada aqui pode ler state.
  function normCirculos(lista) {
    const vistos = {};
    let noPalco = 0;
    for (let i = lista.length - 1; i >= 0; i--) {
      const c = lista[i];
      if (!c || typeof c !== 'object' || !defCirc(c.id)) { lista.splice(i, 1); continue; }
      if (vistos[c.id]) { lista.splice(i, 1); continue; } // duplicata: fica só a mais nova (ele reabre o círculo, não empilha o registro)
      vistos[c.id] = true;
      if (typeof c.camadas !== 'number' || c.camadas < 1) c.camadas = 1;
      if (c.camadas > CIR_MAX_POR_CIRCULO) c.camadas = CIR_MAX_POR_CIRCULO;
      if (typeof c.usos !== 'number' || c.usos < 0) c.usos = 0;
      if (c.usos > 9) c.usos = 9;
      if (c.usos === 0) { vistos[c.id] = false; lista.splice(i, 1); continue; }
      noPalco += c.camadas;
    }
    while (noPalco > CIR_MAX_NO_PALCO && lista.length) { const c = lista.pop(); noPalco -= c.camadas; } // save antigo mais solto que a regra nova
    return lista;
  }
  function camadasDe(id) { const c = achaCirc(id); return c ? c.camadas : 0; }
  function camadasNoPalco() { return state.circulos.reduce(function (a, c) { return a + c.camadas; }, 0); }
  // o degrau decrescente: 1 camada = +5, 2 = +8, 3 = +10 — e nunca acima do teto
  function bonusCamadas(n) {
    let b = 0;
    for (let i = 0; i < Math.min(n, CIR_CURVA.length); i++) b += CIR_CURVA[i];
    return Math.min(CIR_TETO, b);
  }
  function custoProximaCamada(def) {
    const proxima = camadasDe(def.id) + 1;
    return def.base + (CIR_CUSTO_CRESC[proxima - 1] !== undefined ? CIR_CUSTO_CRESC[proxima - 1] : 4);
  }
  // quais círculos abertos entram numa conta ('forca', 'destreza', 'dano'…) e quanto eles somam
  function circulosPara(chave) {
    const ids = []; let b = 0;
    if (!chave) return { b: 0, ids: ids };
    state.circulos.forEach(function (c) {
      const d = defCirc(c.id);
      if (d && d.somaEm.indexOf(chave) !== -1) { ids.push(c.id); b += bonusCamadas(c.camadas); }
    });
    return { b: Math.min(CIR_TETO, b), ids: ids };
  }
  function circuloBonus(chave) { return circulosPara(chave).b; }
  function reservaDe(tipo) {
    let v = 0;
    state.circulos.forEach(function (c) { const d = defCirc(c.id); if (d && d.reserva === tipo) v += bonusCamadas(c.camadas); });
    return Math.min(CIR_TETO, v);
  }
  // toda rolagem que aproveitou um círculo queima 1 uso dele; no 0, o traçado se desfaz.
  // E a regra do próprio Nox: velocidade sem resistência cobra o corpo.
  function queimaCirculos(chave) {
    const r = circulosPara(chave);
    if (!r.ids.length) return '';
    let aviso = '';
    r.ids.forEach(function (id) {
      const c = achaCirc(id); if (!c) return;
      c.usos--;
      if (c.usos <= 0) { state.circulos.splice(state.circulos.indexOf(c), 1); aviso += '  ⭕ ' + defCirc(id).nome + ' se desfez.'; }
    });
    if (r.ids.indexOf('syran') !== -1 && !achaCirc('tharun')) {
      state.san = Math.max(0, state.san - CIR_SYRAN_SEM_THARUN);
      aviso += '  💨 −' + CIR_SYRAN_SEM_THARUN + '🧵 (Syran sem Tharun)';
    }
    renderCirculos(); renderSAN(); save();
    return aviso;
  }
  // queima 1 uso de um círculo específico — pro Elyr (a absorção gasta quando bebe um impacto)
  // e pro Vael'Nor (cada passagem atravessada custa um uso), que nunca entram numa rolagem comum
  function queimaUmUso(id) {
    const c = achaCirc(id); if (!c) return '';
    c.usos--;
    let aviso = '';
    if (c.usos <= 0) { state.circulos.splice(state.circulos.indexOf(c), 1); aviso = '  ⭕ ' + defCirc(id).nome + ' se desfez.'; }
    renderCirculos(); save();
    return aviso;
  }
  function fechaCirculo(id, loga) {
    const c = achaCirc(id); if (!c) return;
    state.circulos.splice(state.circulos.indexOf(c), 1);
    renderCirculos(); save();
    if (loga !== false) activity(WHO, '⭕ fechou ' + (defCirc(id) ? defCirc(id).nome : id));
  }
  function circuloDisponivel(def) { return !!def.mundoReal || state.mundo === 'outro'; }

  // Traçar = pagar a camada e abrir o desenho. O teste é de controle (Inteligência), não de força.
  // 1 natural: o gizlo abre torto — a Linha vai embora e o círculo não fica. 10: o traçado gruda (+1 uso).
  function tracaCirculo(def, out) {
    if (mortoBlock(out)) return;
    // diz = escrever na linha do card E guardar a frase (o re-render dos cards apaga o DOM antigo)
    function diz(t) { circMsg = { id: def.id, txt: t }; out.textContent = t; }
    if (!circuloDisponivel(def)) {
      // aspa tipográfica no texto, aspas simples no código: a frase tinha um ’ que fechava o literal no meio
      diz('🔒 No Mundo Real a magia dele dorme — sobram as passagens (Vael\u2019Nor).');
      activity(WHO, '⛔ tentou traçar ' + def.nome + ' no Mundo Real');
      return;
    }
    const atual = camadasDe(def.id);
    if (atual >= CIR_MAX_POR_CIRCULO) { diz('⭕ ' + def.nome + ' já está com as ' + CIR_MAX_POR_CIRCULO + ' camadas dele — sobrepor mais não rende: feche e abra de novo.'); return; }
    if (camadasNoPalco() >= CIR_MAX_NO_PALCO) { diz('⭕ o palco está cheio: ' + CIR_MAX_NO_PALCO + ' camadas no máximo ao mesmo tempo. Feche um círculo antes.'); return; }
    const custo = custoProximaCamada(def);
    if (state.san < custo) {
      diz('🧵 Linha curta: a camada custa ' + custo + ' e ele só tem ' + state.san + '. Emende (🪡 + Emenda) ou peça ao mestre.');
      activity(WHO, '⛔ sem linha pra camada de ' + def.nome + ' (pedia ' + custo + ' 🧵)');
      return;
    }
    state.san = Math.max(0, state.san - custo); renderSAN(); // paga primeiro, desenha depois
    const a = state.atributos.inteligencia;
    const m = a.valor + mundoBonus() + formBonus('inteligencia') + cardBonus(); // de propósito sem círculo: traçar não gasta o próprio traçado
    const face = 1 + Math.floor(Math.random() * 10);
    const total = face + m;
    let det = '';
    if (mundoBonus() > 0) det += ' + 3🌀';
    if (mundoBonus() < 0) det += ' − 2🧵';
    if (cardBonus() !== 0) det += cardDetail();
    addRoll({
      who: WHO,
      txt: '⭕ Círculo · ' + def.nome + ' camada ' + (atual + 1) + ' (d10 ' + fmtMod(m) + det + ' · −' + custo + '🧵)',
      total: total, detalhe: String(face), classe: face === 10 ? 'log-crit' : (face === 1 ? 'log-fumble' : '')
    });
    if (face === 1) {
      diz('✧ ' + face + ' + ' + a.valor + det + ' = ' + total + '  ·  o traçado abriu torto e desfez — 🧵 −' + custo + ' (ficou ' + state.san + ').');
      applyWorldRisk(face);
      save(); renderCirculos();
      return;
    }
    let c = achaCirc(def.id);
    if (!c) { c = { id: def.id, camadas: 0, usos: 0 }; state.circulos.push(c); }
    c.camadas = atual + 1;
    c.usos = CIR_USOS + (face === 10 ? 1 : 0);
    const novoB = bonusCamadas(c.camadas);
    diz('🕯 ' + face + ' + ' + a.valor + det + ' = ' + total + '  ·  ' + def.nome + ' em ' + c.camadas + ' camada' + (c.camadas > 1 ? 's' : '') +
      (def.somaEm.length ? ' → +' + novoB + ' · ' + c.usos + ' usos' : ' → ' + (c.usos) + ' usos') +
      '  ·  🧵 −' + custo + ' (ficou ' + state.san + ')' + (face === 10 ? '  ✦ o traçado grudou.' : ''));
    applyWorldRisk(face);
    renderCirculos(); save();
    activity(WHO, '⭕ traçou ' + def.nome + ' (camada ' + c.camadas + ' · −' + custo + '🧵)');
  }

  const $ = (id) => document.getElementById(id);
  // bind seguro: um elemento faltando (cache antiga) não derruba a ficha inteira
  function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); }

  // ---------- Abas ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      const alvo = $('panel-' + btn.dataset.tab);
      if (alvo) alvo.classList.add('active');
    });
  });

  // ---------- Atributos ----------
  // O bônus que soma no d10 É o número do atributo (1..5 na regra nova). A conta velha de D&D,
  // (valor − 10) ÷ 2, com atributo pequeno devolveria 0 em tudo: o ataque ficaria mudo.
  // O fallback é a MESMA conta da ECLIPSE_ATR: sem o arquivo, a ficha rola com o número certo.
  function mod(v) { return (window.ECLIPSE_ATR ? ECLIPSE_ATR.mod(v) : Math.max(0, Math.round(Number(v)) || 0)); }
  function fmtMod(m) { return (m >= 0 ? '+' : '−') + Math.abs(m); } // mesmo − (U+2212) das marcas de carta, sem misturar com hífen

  const STATUS_MAX = 6;
  const ST_DESFIA = '🧵 Desfiando';

  // Bônus/penalidade do estado atual (igual a Flora: um estado por vez)
  function mundoBonus() {
    if (state.status.indexOf(ST_DESFIA) !== -1) return -2;
    if (state.mundo === 'outro') return 3;
    return 0;
  }
  // Peles do Mundo Real: cada forma turbinava UM atributo dela (+2, sem risco)
  /* 🧍 A pele de humano (07/10) não turbina nada, e isso é decisão de mesa, não esquecimento:
     o colar empresta a forma dele de andar entre a gente, não uma vantagem de bicho. Se ele
     ganhasse +2 em tudo aqui, o +6 do massacre e o bônus da pele virariam a mesma compra duas
     vezes. Ela EXISTE só enquanto o 🩸 colar estiver na mão (ver `extaseOn`). */
  function formBonus(attrKey) {
    if (!attrKey || state.mundo !== 'real') return 0;
    if (state.status.indexOf(ST_DESFIA) !== -1) return 0; // pele frouxa não ajuda
    if (state.forma === 'coelho' && attrKey === 'destreza') return 2;
    if (state.forma === 'lobo' && attrKey === 'forca') return 2;
    return 0;
  }
  /* 🩸 MASSACRE (07/10): o colar com pingente de sangue do Nox é um dos seis itens que o mestre
     ditou, e a regra é da mesa inteira: +6 em tudo, sem noção de certo e errado, e ele consegue
     se transformar em HUMANO enquanto durar. O estado mora na chave compartilhada
     `eclipse_extase_v1` (js/extase.js) — não dentro desta ficha — para que o painel do mestre e
     os cinco colegas vejam a mesma coisa ao mesmo tempo. Ficha sem o módulo na página (cache
     velha) rola exatamente como rolava antes: o bônus é 0 e nada quebra. */
  function extaseBonus() { var X = window.ECLIPSE_EXTASE; return X ? X.valor(SAVE_KEY) : 0; }
  function extaseDetail() { const v = extaseBonus(); return v ? ' + ' + v + '🩸' : ''; }
  function bonusTotal(attrKey) { return mundoBonus() + formBonus(attrKey) + cardBonus() + circuloBonus(attrKey) + extaseBonus(); }
    // Detalha o bônus peça por peça (pra rolagem bater com o número do Status)
  function bonusDetail(attrKey) {
      let s = '';
      const mb = mundoBonus();
      if (mb > 0) s += ' + 3🌀';
      if (mb < 0) s += ' − 2🧵';
      const fb = formBonus(attrKey);
      if (fb > 0) s += ' + ' + fb + (state.forma === 'coelho' ? '🐇' : '🐺');
      const cb = circuloBonus(attrKey);
      if (cb > 0) s += ' + ' + cb + '⭕';
      return extaseDetail() + s + cardDetail();
  }
  // Cartas do Dante aplicadas aqui chegam como marca "emoji Nome · +N" — somam nas rolagens
  function chipValue(txt) {
    const m = /·\s*([+−])\s*(\d+)$/.exec(String(txt || ''));
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * Math.min(3, parseInt(m[2], 10) || 0);
  }
  function cardBonus() { return state.status.reduce(function (acc, s) { return acc + chipValue(s); }, 0); }
  function isCardChip(txt) { return chipValue(txt) !== 0 || /·\s*[+−]\s*\d+$/.test(String(txt || '')); }
  // Morte/Incapacitado são do mestre: o Nox não pode tirar clicando no chip (Desfiando ele pode — é a pele dele)
  const GM_ONLY = ['☠️ Morto', '🟡 Incapacitado', '☠️ MORTA', '🟡 Incapacitada'];
  // ---------- Morto não age ----------
  // Ceifado pelo Dante (ou pelo mestre), ele não rola dado nem se levanta sozinho.
  const MARCAS_MORTE = ['☠️ Morto', '☠️ MORTA'];
  function estaMorto() {
    for (var i = 0; i < MARCAS_MORTE.length; i++) { if (state.status.indexOf(MARCAS_MORTE[i]) !== -1) return true; }
    return false;
  }
  function mortoBlock(box) {
    if (!estaMorto()) return false;
    if (box) box.textContent = '☠️ morto não age';
    const m = $('statusMsg');
    if (m) m.textContent = '☠️ Nox está MORTO — morto não rola nem se levanta. Só O Mundo 🌍, O Julgamento 🎺 ou o [Restaurar] do mestre.';
    activity(WHO, '⛔ tentou agir estando morto');
    return true;
  }
  function cardDetail() {
    let s = '';
    state.status.forEach(function (t) {
      const v = chipValue(t);
      if (v) s += (v > 0 ? ' + ' : ' − ') + Math.abs(v) + (String(t).split(' ')[0] || '🃏');
    });
    return s;
  }
  // Risco do Outro Mundo: 1 natural ali deixa o Nox desfiando (a pele/verdadeiro corpo abre ponto)
  function applyWorldRisk(natural) {
    if (state.mundo === 'outro' && natural === 1 && state.status.indexOf(ST_DESFIA) === -1 && state.status.length < STATUS_MAX) {
      state.status.unshift(ST_DESFIA);
      renderStatus(); save();
      return true;
    }
    return false;
  }

  function rollAttr(key, card) {
    const a = state.atributos[key]; if (!a) return;
    if (mortoBlock(card.querySelector('.attr-result'))) return;
    const v = a.valor;
    const m = v + bonusTotal(key);
    const face = 1 + Math.floor(Math.random() * 10);
    const total = face + m;
    const det = bonusDetail(key);
    const resBox = card.querySelector('.attr-result');
    if (resBox) resBox.textContent = '🎲 ' + face + ' + ' + v + det + ' = ' + total;
    card.classList.remove('rolled'); void card.offsetWidth; card.classList.add('rolled');
    let classe = '';
    if (face === 10) classe = 'log-crit';
    if (face === 1) classe = 'log-fumble';
    addRoll({ who: WHO, txt: 'Rolou ' + a.nome + ' · d10 ' + fmtMod(m) + det, total: total, detalhe: String(face), classe: classe });
    const q = queimaCirculos(key); // o círculo que entrou na conta perde um uso
    if (q && resBox) resBox.textContent += q;
    applyWorldRisk(face);
  }

  function renderAttrs() {
    const grid = $('attrsGrid'); if (!grid) return;
    const A = window.ECLIPSE_ATR;
    const lo = A ? A.base : 0, hi = A ? A.teto : 30;
    grid.innerHTML = '';
    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const card = document.createElement('div');
      card.className = 'attr-card';
      card.innerHTML =
        '<div class="attr-name">' + a.nome + '</div>' +
        '<input class="attr-value" type="number" min="' + lo + '" max="' + hi + '" value="' + a.valor + '" />' +
        '<div class="attr-mod">' + fmtMod(mod(a.valor)) + '</div>' +
        '<div class="attr-result"></div>' +
        '<div class="attr-hint">🎲 d10 + valor do Status (+ bônus da forma/mundo)</div>';
      const input = card.querySelector('input');
      input.addEventListener('input', function () {
        const n = parseInt(input.value, 10);
        if (isNaN(n)) return;
        a.valor = A ? A.ajustar(state, key, n) : Math.max(0, Math.min(30, n)); // teto de 4 pontos, 10 no total
        card.querySelector('.attr-mod').textContent = fmtMod(mod(a.valor));
        fillBonusOptions(); save();
        if (A) A.painel(grid, state);
      });
      input.addEventListener('blur', function () { input.value = a.valor; });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      card.addEventListener('click', function () { rollAttr(key, card); });
      grid.appendChild(card);
    });
    fillBonusOptions();
    if (A) A.painel(grid, state); // a linha da regra + o contador de pontos
  }

  function fillBonusOptions() {
    const sel = $('attrBonus'); if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="none">nenhum atributo</option>';
    Object.keys(state.atributos).forEach(function (key) {
      const a = state.atributos[key];
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = a.nome + ' (' + fmtMod(mod(a.valor)) + ')';
      sel.appendChild(opt);
    });
    sel.value = atual || 'none';
  }

  // ---------- Enchimento (HP) ----------
  function renderHP() {
    const fill = $('hpFill'), txt = $('hpText'); if (!fill || !txt) return;
    const pct = Math.max(0, Math.min(100, (state.hp / state.hpMax) * 100));
    fill.style.width = pct + '%';
    txt.textContent = state.hp + ' / ' + state.hpMax;
    fill.style.background = pct <= 25
      ? 'linear-gradient(90deg,#8a2f45,#c0455f)'
      : 'linear-gradient(90deg,#2a9d8f,#56c4b6)';
  }
  on('hpDmg', 'click', function () {
    // Elyr aberto bebe um pedaço do impacto antes de ele rasgar o enchimento
    const bruto = parseInt($('hpInput').value, 10) || 0;
    const abs = Math.min(reservaDe('absorcao'), Math.max(0, bruto));
    const aplicado = Math.max(0, bruto - abs);
    state.hp = Math.max(0, state.hp - aplicado);
    renderHP(); save();
    const m = $('statusMsg');
    if (abs > 0) {
      const q = queimaUmUso('elyr'); // bebeu um impacto = gastou um uso do desenho
      if (m) m.textContent = '🫗 Elyr silenciou ' + abs + ' de impacto — entrou ' + aplicado + ' dos ' + bruto + ' que vieram.' + q;
    }
  });
  on('hpHeal', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.hp = Math.min(state.hpMax, state.hp + (parseInt($('hpInput').value, 10) || 0)); renderHP(); save(); });
  on('hpMax', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.hp = state.hpMax; renderHP(); save(); });

  // ---------- Linha (SAN) ----------
  function renderSAN() {
    const fill = $('sanFill'), txt = $('sanText'); if (!fill || !txt) return;
    const pct = Math.max(0, Math.min(100, (state.san / state.sanMax) * 100));
    fill.style.width = pct + '%';
    txt.textContent = state.san + ' / ' + state.sanMax;
    fill.style.background = pct <= 25
      ? 'linear-gradient(90deg,#4a3f6b,#6b4fa0)'
      : pct <= 55
        ? 'linear-gradient(90deg,#6b4fa0,#9179c4)'
        : 'linear-gradient(90deg,#9179c4,#c3b1e8)';
  }
  on('sanDmg', 'click', function () { state.san = Math.max(0, state.san - (parseInt($('sanInput').value, 10) || 0)); renderSAN(); save(); });
  on('sanHeal', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.san = Math.min(state.sanMax, state.san + (parseInt($('sanInput').value, 10) || 0)); renderSAN(); save(); });
  on('sanMax', 'click', function () { if (mortoBlock($('statusMsg'))) return; state.san = state.sanMax; renderSAN(); save(); });

  // ---------- Efeitos ----------
  function renderStatus() {
    const box = $('statusChips'); if (!box) return;
    box.innerHTML = '';
    const count = $('statusCount'); if (count) count.textContent = state.status.length + '/' + STATUS_MAX;
    if (!state.status.length) { box.innerHTML = '<span class="chip empty">sem efeitos — adicione com ＋ ou aguarde o mestre</span>'; return; }
    state.status.forEach(function (s, i) {
      const chip = document.createElement('span');
      const gm = GM_ONLY.indexOf(s) !== -1;     // morte/incapacitado: só o mestre desfaz
      const carta = !gm && isCardChip(s);
      chip.className = 'chip' + (s === ST_DESFIA ? ' desfiando' : '') + (gm ? ' gm' : (carta ? ' carta' + (chipValue(s) < 0 ? ' carta-neg' : '') : ''));
      chip.title = gm ? 'Só o mestre desfaz isso' : (carta ? 'Descartar esta marca de carta' : 'Clique para remover');
      chip.textContent = s;
      chip.addEventListener('click', function () {
        if (gm) {
          const m = $('statusMsg');
          if (m) m.textContent = '☠️ ' + s + ' é decisão do mestre — só o [Restaurar] dele (ou o Dante com O Mundo / O Julgamento) costura de volta.';
          return;
        }
        state.status.splice(i, 1); renderStatus(); save();
      });
      box.appendChild(chip);
    });
  }
  function addStatus(nome) {
    nome = (nome || '').trim(); if (!nome) return '';
    if (state.status.length >= STATUS_MAX) return 'Limite de ' + STATUS_MAX + ' efeitos atingido.';
    if (state.status.indexOf(nome) !== -1) return '“' + nome + '” já está ativo.';
    state.status.push(nome); renderStatus(); save(); return 'Novo efeito: “' + nome + '”.';
  }
  on('statusAddBtn', 'click', function () { $('statusMsg').textContent = addStatus($('statusInput').value); $('statusInput').value = ''; });
  on('statusInput', 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('statusMsg').textContent = addStatus(this.value); this.value = ''; } });

  // ---------- Dois Mundos + Formas ----------
  function renderWorld() {
    const wn = $('worldName'), wd = $('worldDesc'); if (!wn || !wd) return;
    const outro = state.mundo === 'outro';
    document.body.classList.toggle('world-outro', outro);
    wn.textContent = outro ? 'Outro Mundo' : 'Mundo Real';
    wd.textContent = outro
      ? 'Aqui ele não usa peles: anda na Forma Verdadeira, humanoide. Os círculos acordam no chão dele — mas um passo em falso e abre ponto.'
      : 'Cinza e quieto. A magia dorme — sobra o ofício das peles e a passagem que ninguém vê.';
    const mr = $('mundoReal'), mo = $('mundoOutro');
    if (mr) mr.classList.toggle('on', !outro);
    if (mo) mo.classList.toggle('on', outro);
    renderForm();
  }
  function extaseOn() { var X = window.ECLIPSE_EXTASE; return !!(X && X.ativa && X.ativa(SAVE_KEY)); }
  function renderForm() {
    const fc = $('formaCoelho'), fl = $('formaLobo'), ft = $('formaTrue'), note = $('formNote');
    if (!fc || !fl || !ft || !note) return; // HTML antigo em cache: só ignora as formas
    const outro = state.mundo === 'outro';
    const colar = extaseOn();
    const fh = $('formaHumano');
    /* A pele de gente vem com o colar: quando o objeto sai da mão (na ficha dele, no painel do
       mestre ou noutro aparelho), ela cai de volta no coelho — a pele que ele usa por padrão. O
       botão some junto com a chance, para ninguém clicar numa forma que não existe. */
    if (!colar && state.forma === 'humano') { state.forma = 'coelho'; save(); }
    if (fh) {
      fh.hidden = !colar;
      fh.disabled = outro;
      fh.classList.toggle('on', !outro && state.forma === 'humano');
    }
    fc.classList.toggle('on', !outro && state.forma === 'coelho');
    fl.classList.toggle('on', !outro && state.forma === 'lobo');
    fc.disabled = outro;
    fl.disabled = outro;
    ft.hidden = !outro;
    // no Outro Mundo o formNote já explica tudo — esconde o world-note p/ não duplicar texto
    const wnote = document.querySelector('.world-note');
    if (wnote) wnote.hidden = outro;
    note.innerHTML = outro
      ? 'No Outro Mundo não há escolha: ele anda na <b>Forma Verdadeira</b> — <b>+3 em tudo</b>, mas com o risco de abrir ponto.'
      : (colar
        ? 'No Mundo Real ele veste peles de animal: <b>🐇 coelho</b> dá <b>+2 em Destreza</b>, <b>🐺 lobo</b> dá <b>+2 em Força</b> — sem risco. Com o <b>🩸 colar</b> na mão ele também pode vestir <b>🧍 gente</b>: é a forma dele de andar no meio deles, <b>sem bônus de pele nenhum</b> (o +6 já vem do massacre).'
        : 'No Mundo Real ele veste peles de animal: <b>🐇 coelho</b> dá <b>+2 em Destreza</b>, <b>🐺 lobo</b> dá <b>+2 em Força</b> — sem risco. A pele de <b>🧍 gente</b> só existe com o <b>🩸 colar com pingente de sangue na mão</b> (aba Massacre).');
    renderCirculos(); // o mundo é quem decide quais círculos acordam (e a faixa de travados da aba Magia)
  }
  // Atmosfera do crepúsculo: monta uma vez a camada de névoa + bolinhas pretas caindo.
  // Quem decide se aparece é só o CSS (body.world-outro) — aqui não liga/desliga nada, só povoa a tela.
  // (se o Windows estiver com "animações reduzidas", o CSS segura a queda mais lenta: nada de sumir com o efeito)
  function mountTwilight() {
    const box = $('twAtmos');
    if (!box || box.children.length) return; // já montado, ou HTML antigo em cache: segue o jogo sem a camada
    for (let i = 0; i < 3; i++) { // as nuvens de névoa (tamanho/posição vêm do CSS)
      const f = document.createElement('i');
      f.className = 'tw-fog';
      f.style.animationDuration = (20 + i * 7) + 's';
      f.style.animationDelay = (-6 * i) + 's';
      box.appendChild(f);
    }
    for (let i = 0; i < 12; i++) { // farelo preto: miúdo e esmaecido — é atmosfera, não obstáculo na frente da letra
      const o = document.createElement('i');
      const tam = 2.5 + Math.random() * 4.5;                       // 2,5 a 7px
      o.className = 'tw-orb';
      o.style.width = tam.toFixed(1) + 'px';
      o.style.height = tam.toFixed(1) + 'px';
      o.style.left = (Math.random() * 100).toFixed(2) + '%';
      o.style.animationDuration = (9 + Math.random() * 11).toFixed(2) + 's';
      o.style.animationDelay = (-Math.random() * 16).toFixed(2) + 's'; // negativo: a tela já começa no meio da chuva
      o.style.setProperty('--tw-dx', (Math.random() * 44 - 22).toFixed(0) + 'px');
      o.style.setProperty('--tw-o', (0.18 + Math.random() * 0.24).toFixed(2)); // 0,18 a 0,42
      box.appendChild(o);
    }
  }
  function setMundo(w) {
    if (state.mundo === w) return;
    state.mundo = w;
    // o desenho não atravessa com ele: mudar de mundo fecha todos os círculos abertos
    if (state.circulos.length) {
      const n = state.circulos.length;
      state.circulos = [];
      renderCirculos();
      activity(WHO, '⭕ ' + n + ' círculo' + (n > 1 ? 's' : '') + ' se fechou na passagem');
    }
    renderWorld(); save();
  }
  function setForm(f) {
    /* A pele de gente é emprestada pelo colar: sem o massacre na mão, o botão até existe na
       memória de quem clicou antes de o mestre tirar o objeto — e a ficha recusa em português. */
    if (f === 'humano' && !extaseOn()) {
      const m = $('statusMsg');
      if (m) m.textContent = '⚠ Sem o 🩸 colar na mão, ele não veste gente. A pele de humano é do massacre.';
      renderForm();
      return;
    }
    if (state.forma === f) return;
    state.forma = f; renderForm(); save();
  }
  on('mundoReal', 'click', function () { setMundo('real'); activity(WHO, '🌫️ voltou pro Mundo Real'); });
  on('mundoOutro', 'click', function () { setMundo('outro'); activity(WHO, '🌀 atravessou pro Outro Mundo — Forma Verdadeira'); });
  on('formaCoelho', 'click', function () { setForm('coelho'); activity(WHO, '🐇 vestiu a pele de coelho'); });
  on('formaLobo', 'click', function () { setForm('lobo'); activity(WHO, '🐺 vestiu a pele de lobo'); });
  if ($('formaHumano')) on('formaHumano', 'click', function () {
    setForm('humano');
    if (state.forma === 'humano') activity(WHO, '🧍 vestiu a pele de gente (🩸 colar)');
  });
  on('mundoDescansar', 'click', function () {
    const i = state.status.indexOf(ST_DESFIA);
    if (i === -1) { $('statusMsg').textContent = 'Ele está inteiro — nada para refazer.'; return; }
    state.status.splice(i, 1); renderStatus(); save();
    $('statusMsg').textContent = '🪡 Pontinho costurado. Ele volta ao normal.';
  });

  // ---------- Inventário (armas enviadas pelo mestre · mesma mecânica da Flora) ----------
  function parseDice(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (m) {
      const qtde = m[1] === '' ? 1 : parseInt(m[1], 10);
      const faces = parseInt(m[2], 10);
      if (!faces) return null;
      return { qtde: qtde, faces: faces, bonus: m[3] ? parseInt(m[3], 10) : 0 };
    }
    const f = s.match(/^([+-]?\d+)$/);
    if (f) return { qtde: 0, faces: 0, bonus: parseInt(f[1], 10) || 0 }; // dano fixo
    return null;
  }
  function rollWeapon(w, li) {
    const d = parseDice(w.dano);
    const out = li.querySelector('.weapon-result');
    if (mortoBlock(out)) return;
    if (!d) { out.textContent = '⚠ o mestre precisa definir um dano (ex: d8+2).'; return; }
    const wb = mundoBonus(); // +3 no Outro Mundo · −2 se Desfiando (dano não usa pele de forma)
    const ci = circulosPara('dano'); // círculos de impacto (Vharak · Syran · Kaelith) entram no dano, não na defesa
    const ex = extaseBonus();          // 🩸 +6 do colar, se ele estiver em massacre
    const mb = wb + cardBonus() + ci.b + ex; // cartas do Dante também pesam no dano
    let total, faceTxt, crit = false, fumble = false;
    if (d.qtde >= 1) {
      const r = rollDice(d.faces, d.qtde, d.bonus + mb);
      total = r.total; faceTxt = r.resultados.join(' + ');
      if (d.qtde === 1 && d.faces === 20) { crit = r.resultados[0] === 20; fumble = r.resultados[0] === 1; }
    } else {
      total = d.bonus + mb; faceTxt = 'dano fixo';
    }
    const det = extaseDetail() + (wb > 0 ? ' + 3🌀' : (wb < 0 ? ' − 2🧵' : '')) + (ci.b > 0 ? ' + ' + ci.b + '⭕' : '') + cardDetail();
    out.textContent = '🎲 ' + faceTxt + (d.bonus ? (d.bonus >= 0 ? ' + ' + d.bonus : ' − ' + -d.bonus) : '') + det + ' = ' + total + ' de dano';
    out.classList.remove('show'); void out.offsetWidth; out.classList.add('show');
    addRoll({
      who: WHO,
      txt: 'Dano · ' + w.nome + ' (' + (w.dano || '—') + ')' + det,
      total: total,
      detalhe: faceTxt,
      classe: crit ? 'crit' : (fumble ? 'fumble' : '')
    });
    const qd = queimaCirculos('dano');
    if (qd) out.textContent += qd;
  }
  function renderInv() {
    const area = $('invArea');
    if (!area) return;
    if (!Array.isArray(state.armas) || !state.armas.length) return; // mantém a mensagem de vazio do HTML
    while (area.firstChild) area.removeChild(area.firstChild);
    const ul = document.createElement('ul');
    ul.className = 'weapon-list';
    state.armas.forEach(function (w) {
      const li = document.createElement('li');
      li.className = 'weapon-item';
      const name = document.createElement('span');
      name.className = 'w-name'; name.textContent = '⚔ ' + w.nome;
      const dice = document.createElement('span');
      dice.className = 'w-dice'; dice.textContent = w.dano || '—';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'mini-btn w-roll'; btn.textContent = '🎲 Rolar';
      btn.addEventListener('click', function () { rollWeapon(w, li); });
      const actions = document.createElement('div');
      actions.className = 'w-actions'; actions.appendChild(dice); actions.appendChild(btn);
      const res = document.createElement('p');
      res.className = 'weapon-result';
      li.appendChild(name); li.appendChild(actions); li.appendChild(res);
      ul.appendChild(li);
    });
    area.appendChild(ul);
  }

  // ---------- Histórico compartilhado (global) ----------
  function readRolls() { try { var l = JSON.parse(localStorage.getItem(ROLL_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeRolls(l) { try { localStorage.setItem(ROLL_KEY, JSON.stringify(l)); } catch (e) {} }
  function normClasse(c) { c = String(c || ''); if (c.indexOf('crit') !== -1) return 'crit'; if (c.indexOf('fumble') !== -1) return 'fumble'; return ''; }
  function addRoll(entry) {
    const list = readRolls();
    list.unshift({
      who: entry.who || WHO, txt: entry.txt || 'Rolagem', total: entry.total,
      detalhe: entry.detalhe != null ? String(entry.detalhe) : '', classe: normClasse(entry.classe),
      hora: entry.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now()
    });
    writeRolls(list.slice(0, ROLL_MAX));
    renderLog();
  }
  function renderLog() {
    const ul = $('rollLog'); if (!ul) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    const list = readRolls();
    if (!list.length) { const li0 = document.createElement('li'); li0.className = 'log-empty'; li0.textContent = 'Nenhuma rolagem ainda.'; ul.appendChild(li0); return; }
    list.forEach(function (l) {
      const li = document.createElement('li');
      const main = document.createElement('span');
      if (l.classe === 'crit') main.className = 'log-crit'; else if (l.classe === 'fumble') main.className = 'log-fumble';
      const who = document.createElement('span'); who.className = 'log-who' + (l.who === 'Mestre' ? ' mestre' : ''); who.textContent = l.who || 'Nox';
      const b = document.createElement('b'); b.textContent = l.txt;
      const det = document.createElement('span'); det.className = 'log-detail'; det.textContent = '[' + (l.detalhe != null ? l.detalhe : '') + ']';
      main.appendChild(who); main.appendChild(b); main.appendChild(document.createTextNode(' → ')); main.appendChild(det);
      const tot = document.createElement('span'); tot.className = 'log-total'; tot.textContent = String(l.total);
      const hora = document.createElement('small'); hora.textContent = ' · ' + l.hora; tot.appendChild(hora);
      li.appendChild(main); li.appendChild(tot); ul.appendChild(li);
    });
  }

  // ---------- Rolador d20 (gerais) ----------
  function rollDice(tipo, qtde, bonus) {
    const resultados = []; let soma = 0;
    for (let i = 0; i < qtde; i++) { const r = 1 + Math.floor(Math.random() * tipo); resultados.push(r); soma += r; }
    return { resultados: resultados, total: soma + bonus, bonus: bonus };
  }
  on('rollBtn', 'click', function () {
    if (mortoBlock($('rollMsg'))) return;
    const tipo = parseInt($('diceType').value, 10);
    const qtde = Math.max(1, Math.min(10, parseInt($('diceQty').value, 10) || 1));
    const attrKey = $('attrBonus').value;
    const bonus = (attrKey === 'none' ? 0 : mod(state.atributos[attrKey].valor)) + bonusTotal(attrKey === 'none' ? null : attrKey);
    const die = $('die');
    die.classList.remove('crit', 'fumble', 'spinning'); void die.offsetWidth; die.classList.add('spinning');
    setTimeout(function () {
      const r = rollDice(tipo, qtde, bonus);
      die.textContent = String(r.total);
      const natural = r.resultados[0];
      const det = bonusDetail(attrKey === 'none' ? null : attrKey);
      let msg = 'Total: ' + r.total + (bonus ? ' (' + (r.total - bonus) + ' ' + fmtMod(bonus) + (det ? ' ' + det.trim() : '') + ')' : '');
      let classe = '';
      if (tipo === 20 && qtde === 1 && (attrKey === 'none')) {
        if (natural === 20) { msg = '✦ Acerto crítico! O Outro Mundo aplaude.'; classe = 'crit'; die.classList.add('crit'); }
        if (natural === 1) { msg = '✧ Falha crítica… um chifre apareceu onde não devia.'; classe = 'fumble'; die.classList.add('fumble'); }
      }
      $('rollMsg').textContent = msg;
      addRoll({
        who: WHO,
        txt: (attrKey !== 'none' ? state.atributos[attrKey].nome + ' · ' : '') + 'd' + tipo + (qtde > 1 ? '×' + qtde : '') + (bonus ? (bonus >= 0 ? ' + ' + bonus : ' − ' + -bonus) : ''),
        total: r.total, detalhe: r.resultados.join(', '), classe: classe
      });
      const qr = queimaCirculos(attrKey === 'none' ? null : attrKey);
      if (qr) $('rollMsg').textContent = msg + qr;
      if (tipo === 20 && qtde === 1) applyWorldRisk(natural);
    }, 550);
  });

  // ---------- Poderes ----------
  function renderPoderes() {
    const grid = $('powersGrid'); if (!grid) return;
    grid.innerHTML = '';
    state.poderes.forEach(function (p) {
      const card = document.createElement('div'); card.className = 'power-card';
      const attrValido = p.atributo && state.atributos[p.atributo];
      const a = attrValido ? state.atributos[p.atributo] : null;
      const custo = custoOf(p);
      card.innerHTML =
        '<div class="power-name" contenteditable="true" spellcheck="false">' + p.nome + '</div>' +
        '<div class="power-row"><span class="power-tag">' + p.tipo + '</span>' +
        (custo > 0 ? '<span class="power-cost" title="o que ele paga de Linha cada vez que usa">🧵 ' + custo + ' de Linha</span>' : '') +
        '</div>' +
        '<p class="power-desc" contenteditable="true" spellcheck="false">' + p.desc + '</p>' +
        (attrValido ? '<button class="mini-btn power-roll-btn">🎲 Usar · d10 +' + a.valor + ' (' + a.nome + ')' + (custo > 0 ? ' · −' + custo + ' 🧵' : '') + '</button><p class="combat-result"></p>' : '');
      card.querySelector('.power-name').addEventListener('blur', function (e) { p.nome = e.target.textContent.trim(); save(); });
      card.querySelector('.power-desc').addEventListener('blur', function (e) { p.desc = e.target.innerHTML; save(); });
      const btn = card.querySelector('.power-roll-btn');
      if (btn) btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const box = card.querySelector('.combat-result');
        if (mortoBlock(box)) return;
        if (!a) return;
        // primeiro se paga, depois se rola: sem Linha no corpo o poder simplesmente não sai
        if (custo > 0 && state.san < custo) {
          box.textContent = '🧵 Linha curta: custa ' + custo + ' e ele só tem ' + state.san + '. Emende (🪡 + Emenda) ou peça ao mestre.';
          activity(WHO, '⛔ sem linha pra ' + p.nome + ' (pedia ' + custo + ' 🧵)');
          return;
        }
        const m = a.valor + bonusTotal(p.atributo);
        const face = 1 + Math.floor(Math.random() * 10);
        const total = face + m;
        const det = bonusDetail(p.atributo);
        if (custo > 0) { state.san = Math.max(0, state.san - custo); renderSAN(); save(); }
        box.textContent = '🎲 ' + face + ' + ' + a.valor + det + ' = ' + total +
          (custo > 0 ? '  ·  🧵 −' + custo + ' de linha (ficou ' + state.san + ')' : '');
        const classe = face === 10 ? 'log-crit' : (face === 1 ? 'log-fumble' : '');
        addRoll({ who: WHO, txt: 'Poder · ' + p.nome + ' (d10 ' + fmtMod(m) + (custo > 0 ? ' · −' + custo + '🧵' : '') + ')' + det, total: total, detalhe: String(face), classe: classe });
        const q = queimaCirculos(p.atributo); // se um círculo entrou nesta conta, ele gasta um uso
        if (q) box.textContent += q;
        if (applyWorldRisk(face)) box.textContent += '  🧵 desfiou!';
      });
      grid.appendChild(card);
    });
  }

  // ---------- Círculos na tela ----------
  const CIR_ICONE = { vharak: '💪', syran: '💨', tharun: '🛡', aeryn: '👁', kaelith: '🌀', elyr: '🫗', vaelnor: '🕳' };
  // a última frase de traçado, guardada fora do DOM: renderCirculos() remonta os cards e levaria o texto junto
  let circMsg = null;
  function dizCirculo(id, txt) { circMsg = { id: id, txt: txt }; }
  function rotuloDeChave(k) {
    if (k === 'dano') return 'dano';
    return state.atributos[k] ? state.atributos[k].nome : k;
  }
  function rotuloReserva(r) {
    return r === 'resistencia' ? '🛡 resistência declarada'
      : r === 'absorcao' ? '🫗 bebe impacto'
      : '🕳 passagem (sem bônus)';
  }
  function renderCirculos() {
    const grid = $('circGrid');
    if (grid) {
      grid.innerHTML = '';
      CIRCULOS.forEach(function (d) {
        const aberto = achaCirc(d.id);
        const pode = circuloDisponivel(d);
        const card = document.createElement('div');
        card.className = 'circ-card' + (aberto ? ' aberto' : '') + (pode ? '' : ' locked');
        const alvo = d.somaEm.length ? d.somaEm.map(rotuloDeChave).join(' · ') : rotuloReserva(d.reserva);
        card.innerHTML =
          '<div class="circ-head"><span class="circ-nome">' + (CIR_ICONE[d.id] || '⭕') + ' ' + d.nome + '</span>' +
          '<span class="circ-titulo">' + d.titulo + '</span></div>' +
          '<p class="circ-cantico">“' + d.cantico + '”</p>' +
          '<p class="circ-efeito">' + d.efeito + '</p>' +
          '<p class="circ-nao">✧ ' + d.naoFaz + '</p>' +
          '<div class="circ-row"><span class="circ-tag">entra em: ' + alvo + '</span>' +
          '<span class="circ-cost" title="o que a próxima camada cobra de Linha">🧵 ' + custoProximaCamada(d) + '</span>' +
          (aberto ? '<span class="circ-open-tag">aberto: ' + aberto.camadas + ' camada' + (aberto.camadas > 1 ? 's' : '') +
            (d.somaEm.length ? ' · +' + bonusCamadas(aberto.camadas) : '') + ' · ' + aberto.usos + ' usos</span>' : '') +
          '</div>' +
          (pode
            ? '<button type="button" class="mini-btn circ-traca no-act">🕯 Traçar camada</button>'
            : '<button type="button" class="mini-btn circ-traca" disabled>🔒 dorme no Mundo Real</button>') +
          '<p class="circ-result combat-result"></p>';
        const btn = card.querySelector('.circ-traca');
        if (btn && pode) btn.addEventListener('click', function (e) { e.stopPropagation(); tracaCirculo(d, card.querySelector('.circ-result')); });
        if (circMsg && circMsg.id === d.id) card.querySelector('.circ-result').textContent = circMsg.txt; // a frase sobrevive à remontagem
        grid.appendChild(card);
      });
    }
    const strip = $('circAbertos');
    if (strip) {
      strip.innerHTML = '';
      if (!state.circulos.length) {
        const v = document.createElement('span');
        v.className = 'chip empty';
        v.textContent = state.mundo === 'outro'
          ? 'nenhum círculo traçado — o chão dele está limpo'
          : '🌫️ no Mundo Real só o que acorda é a passagem (Vael’Nor)';
        strip.appendChild(v);
      }
      state.circulos.forEach(function (c) {
        const d = defCirc(c.id); if (!d) return;
        const chip = document.createElement('span');
        chip.className = 'chip circ-chip';
        chip.innerHTML = (CIR_ICONE[d.id] || '⭕') + ' <b>' + d.nome + '</b> ×' + c.camadas + ' · ' +
          (d.somaEm.length ? '+' + bonusCamadas(c.camadas) + ' · ' + c.usos + ' usos'
            : d.reserva === 'passagem' ? c.usos + (c.usos > 1 ? ' passagens' : ' passagem')
            : '+' + bonusCamadas(c.camadas) + ' ' + rotuloReserva(d.reserva));
        if (d.reserva === 'passagem') {
          const p = document.createElement('button');
          p.type = 'button'; p.className = 'mini-btn circ-pass no-act'; p.textContent = '🕳 Passar';
          p.title = 'atravessa uma fresta (gasta 1 uso)';
          p.addEventListener('click', function (e) {
            e.stopPropagation();
            if (mortoBlock($('statusMsg'))) return;
            const q = queimaUmUso(d.id);
            const m = $('statusMsg');
            if (m) m.textContent = '🕳 ' + (state.mundo === 'real'
              ? 'ninguém viu a passagem: ele só deixou de estar ali — e apareceu onde queria.'
              : 'ele dobrou o espaço e saiu do outro lado.') + q;
            activity(WHO, '🕳 passou por uma fresta (Vael’Nor)');
          });
          chip.appendChild(p);
        }
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'circ-x no-act'; x.textContent = '✕'; x.title = 'Fechar o círculo (de graça)';
        x.addEventListener('click', function (e) { e.stopPropagation(); fechaCirculo(d.id); });
        chip.appendChild(x);
        strip.appendChild(chip);
      });
      const tot = document.createElement('span');
      tot.className = 'circ-total';
      const extras = [];
      const dd = circuloBonus('dano'); if (dd) extras.push('dano +' + dd);
      const res = reservaDe('resistencia'); if (res) extras.push('🛡 +' + res);
      const ab = reservaDe('absorcao'); if (ab) extras.push('🫗 −' + ab + ' do impacto');
      tot.textContent = 'no palco: ' + camadasNoPalco() + '/' + CIR_MAX_NO_PALCO + ' camadas' + (extras.length ? ' · ' + extras.join(' · ') : '');
      strip.appendChild(tot);
    }
    // resumo numa string pronta: o painel do mestre SÓ LÊ isso. A conta fica aqui, numa fonte só —
    // duplicar a curva de camadas nos dois arquivos viraria desbalanceamento silencioso na próxima mudança.
    const partes = [];
    state.circulos.forEach(function (c) {
      const d = defCirc(c.id); if (!d) return;
      partes.push((CIR_ICONE[d.id] || '⭕') + ' ' + d.nome + ' ×' + c.camadas +
        (d.somaEm.length ? ' +' + bonusCamadas(c.camadas) : d.reserva === 'passagem' ? ' ' + c.usos + '🕳' : ' +' + bonusCamadas(c.camadas)));
    });
    state.circResumo = partes.length ? partes.join(' · ') : '';
    save();
  }

  // ---------- Retrato (upload + editor de enquadramento com arrastar/zoom) ----------
  (function () {
    const portraitEl = $('portrait'), portraitImg = $('portraitImg'), portraitHint = $('portraitHint');
    const fileEl = $('portraitFile'), removeBtn = $('portraitRemove');
    if (!portraitEl || !portraitImg || !fileEl) return;
    const STAGE_SIZE = 280;  // diâmetro do círculo no editor

    let portraitData = null; // { src, zoom, panX, panY } — pan em fração do círculo
    // Enquadramento real: a img é dimensionada em pixels (cover × zoom) e
    // posicionada com left/top — assim arrastar alcança até as bordas da foto
    // (com object-fit a img ficava "presa" na caixa e o corte era fixo).
    function applyFraming(el, box, p, nat) {
      if (!el || !nat || !nat.w || !nat.h) return;
      const cover = Math.max(box / nat.w, box / nat.h);
      const s = cover * (p.zoom || 1);
      el.style.width = Math.round(nat.w * s) + 'px';
      el.style.height = Math.round(nat.h * s) + 'px';
      el.style.left = Math.round((box - nat.w * s) / 2 + (p.panX || 0) * box) + 'px';
      el.style.top = Math.round((box - nat.h * s) / 2 + (p.panY || 0) * box) + 'px';
    }
    function renderPortrait() {
      if (!portraitData || !portraitData.src) {
        portraitEl.classList.remove('has-img');
        portraitImg.removeAttribute('src');
        portraitImg.hidden = true;
        if (removeBtn) removeBtn.hidden = true;
        if (portraitHint) portraitHint.textContent = '✦ clicar para carregar imagem ✦';
        return;
      }
      portraitImg.onload = function () {
        applyFraming(portraitImg, portraitEl.clientWidth, portraitData, { w: portraitImg.naturalWidth, h: portraitImg.naturalHeight });
      };
      portraitImg.src = portraitData.src;
      portraitImg.hidden = false;
      portraitEl.classList.add('has-img');
      if (removeBtn) removeBtn.hidden = false;
      if (portraitHint) portraitHint.textContent = '✦ clicar para ajustar ✦';
    }
    function savePortrait() {
      if (!portraitData) { localStorage.removeItem(PORTRAIT_KEY); return; }
      try { localStorage.setItem(PORTRAIT_KEY, JSON.stringify(portraitData)); }
      catch (e) { alert('A imagem ficou visível, mas foi grande demais para salvar localmente. Tente uma versão mais leve.'); }
    }
    // Migração de salvamentos antigos (string crua ou {src} sem enquadramento)
    (function () {
      const raw = localStorage.getItem(PORTRAIT_KEY);
      if (!raw) return;
      if (raw.charAt(0) === '{') {
        try { portraitData = JSON.parse(raw); } catch (e) { portraitData = null; }
      } else {
        portraitData = { src: raw };
      }
      if (portraitData && portraitData.src) {
        if (typeof portraitData.zoom !== 'number') portraitData.zoom = 1;
        if (typeof portraitData.panX !== 'number') portraitData.panX = 0;
        if (typeof portraitData.panY !== 'number') portraitData.panY = 0;
      } else { portraitData = null; }
    })();

    portraitEl.addEventListener('click', function () {
      if (portraitData) { openCrop(null, false); } else { fileEl.click(); }
    });
    portraitEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); portraitEl.click(); }
    });
    fileEl.addEventListener('change', function () {
      const file = fileEl.files && fileEl.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          // Só reduz a resolução pra caber no salvamento local —
          // o enquadramento em si é decidido no editor, sem distorção.
          const MAX = 1100;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            const r = Math.min(MAX / w, MAX / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          // PNG com transparência: achata sobre o roxo do círculo (JPEG ficaria preto)
          ctx.fillStyle = '#2c2340';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          openCrop({ src: canvas.toDataURL('image/jpeg', 0.9), zoom: 1, panX: 0, panY: 0 }, true);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      fileEl.value = '';
    });
    if (removeBtn) removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      portraitData = null;
      renderPortrait();
      savePortrait();
    });

    // ----- modal do editor -----
    const modal = $('cropModal'), stage = $('cropStage'), stageImg = $('cropImg'), zoomSlider = $('cropZoom');
    let crop = null;
    let natural = { w: 1, h: 1 };
    let drag = null;

    function panLimits(z) {
      const s = Math.max(STAGE_SIZE / natural.w, STAGE_SIZE / natural.h);
      const rw = natural.w * s * z, rh = natural.h * s * z;
      return {
        x: Math.max(0, (rw - STAGE_SIZE) / 2) / STAGE_SIZE,
        y: Math.max(0, (rh - STAGE_SIZE) / 2) / STAGE_SIZE
      };
    }
    function clampPan() {
      const l = panLimits(crop.zoom);
      crop.panX = Math.max(-l.x, Math.min(l.x, crop.panX));
      crop.panY = Math.max(-l.y, Math.min(l.y, crop.panY));
    }
    function renderCrop() {
      clampPan();
      applyFraming(stageImg, STAGE_SIZE, crop, natural);
      if (zoomSlider) zoomSlider.value = crop.zoom;
    }
    function openCrop(p, isNew) {
      const base = p || portraitData;
      if (!base || !base.src) return;
      if (!modal || !stage || !stageImg) {
        // editor indisponível (HTML antigo em cache): aplica direto
        portraitData = { src: base.src, zoom: 1, panX: 0, panY: 0 };
        renderPortrait(); savePortrait();
        return;
      }
      crop = { src: base.src, zoom: base.zoom || 1, panX: base.panX || 0, panY: base.panY || 0 };
      if (isNew) { crop.zoom = 1; crop.panX = 0; crop.panY = 0; }
      stageImg.src = crop.src;
      const probe = new Image();
      probe.onload = function () {
        natural = { w: probe.naturalWidth, h: probe.naturalHeight };
        renderCrop();
      };
      probe.src = crop.src;
      modal.hidden = false;
    }
    function closeCrop() { modal.hidden = true; crop = null; drag = null; }

    if (modal && stage && stageImg) {
      stage.addEventListener('pointerdown', function (e) {
        if (!crop) return;
        drag = { x: e.clientX, y: e.clientY, px: crop.panX, py: crop.panY };
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', function (e) {
        if (!crop || !drag) return;
        crop.panX = drag.px + (e.clientX - drag.x) / STAGE_SIZE;
        crop.panY = drag.py + (e.clientY - drag.y) / STAGE_SIZE;
        renderCrop();
      });
      stage.addEventListener('pointerup', function () { drag = null; });
      stage.addEventListener('pointercancel', function () { drag = null; });
      stage.addEventListener('wheel', function (e) {
        if (!crop) return;
        e.preventDefault();
        crop.zoom = Math.max(1, Math.min(3, crop.zoom - e.deltaY * 0.0015));
        renderCrop();
      }, { passive: false });
    }
    if (zoomSlider) zoomSlider.addEventListener('input', function () {
      if (!crop) return;
      crop.zoom = Math.max(1, Math.min(3, parseFloat(zoomSlider.value) || 1));
      renderCrop();
    });
    on('cropSwap', 'click', function () { closeCrop(); fileEl.click(); });
    on('cropCancel', 'click', function () { closeCrop(); });
    on('cropOk', 'click', function () {
      if (!crop) { closeCrop(); return; }
      portraitData = crop;
      renderPortrait();
      savePortrait();
      closeCrop();
      activity(WHO, '🖼 ajustou o retrato');
    });

    renderPortrait();
  })();

  // ---------- Obsessão + História (persistência por blur) ----------
  (function () {
    const oN = $('obsNome'), oD = $('obsDesc');
    if (oN && oD) {
      if (state.obsessao.nome) oN.textContent = state.obsessao.nome;
      if (state.obsessao.desc) oD.textContent = state.obsessao.desc;
      oN.addEventListener('blur', function () { state.obsessao.nome = oN.textContent.trim(); save(); });
      oD.addEventListener('blur', function () { state.obsessao.desc = oD.textContent.trim(); save(); });
    }
    const story = $('storyText');
    if (story) {
      const stored = localStorage.getItem(STORY_KEY);
      if (stored) story.textContent = stored;
      story.addEventListener('blur', function () { localStorage.setItem(STORY_KEY, story.textContent); });
    }
  })();

  // ---------- Monitor de atividade (cliques/viradas de mundo) ----------
  function readActs() { try { var l = JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function writeActs(l) { try { localStorage.setItem(ACT_KEY, JSON.stringify(l)); } catch (e) {} }
  function activity(who, act) {
    if (!act) return;
    var l = readActs();
    l.unshift({ who: who || WHO, act: String(act).slice(0, 80), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), t: Date.now() });
    writeActs(l.slice(0, ACT_MAX));
  }
  function describeEl(node) {
    if (!node || !node.tagName) return null;
    var act = (node.getAttribute('data-act') || '').trim(); if (act) return act;
    if (node.classList && node.classList.contains('no-act')) return null; // o handler já conta isso direito (traçar círculo, passar pela fresta)
    if (node.classList && node.classList.contains('tab-btn')) return '🗂 abriu a aba ' + (node.textContent || '').trim();
    if (node.tagName === 'A') { var at = (node.textContent || '').trim(); return at ? '🔗 ' + at : null; }
    if (node.tagName === 'BUTTON') {
      var txt = (node.textContent || '').trim();
      if (!txt || txt.indexOf('🎲') !== -1) return null; // rolagens já caem no histórico de rolagem
      return txt.length > 42 ? null : '👆 ' + txt;
    }
    return null;
  }
  document.addEventListener('click', function (e) {
    var node = e.target && e.target.closest ? e.target.closest('button, .tab-btn, a') : null;
    if (!node) return; var desc = describeEl(node); if (desc) activity(WHO, desc);
  }, true);
  document.addEventListener('focusout', function (e) {
    var node = e.target;
    if (node && node.getAttribute && node.getAttribute('contenteditable') === 'true') activity(WHO, '✎ mexeu em um texto');
  }, true);

  // ---------- Cursor-botão (PC) ----------
  (function () {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const btn = $('cursorBtn'); if (!btn) return;
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, rot = 0;
    document.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; btn.style.opacity = '1'; });
    (function loop() { x += (tx - x) * 0.2; y += (ty - y) * 0.2; rot += 1.2; btn.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) rotate(' + rot + 'deg)'; requestAnimationFrame(loop); })();
  })();

  // Ao vivo: rolagens do grupo + mudanças que o mestre faz nesta ficha (armas/efeitos/vidas)
  window.addEventListener('storage', function (e) {
    if (e.key === ROLL_KEY) { renderLog(); return; }
    if (e.key === SAVE_KEY) {
      state = load();
      renderHP(); renderSAN(); renderStatus(); renderWorld(); renderInv();
    }
  });

  // ---------- Boot ----------
  renderAttrs();
  renderHP();
  renderSAN();
  renderStatus();
  renderWorld();
  renderPoderes();
  renderCirculos();
  mountTwilight();
  renderLog();
  renderInv();

  /* 🩸 O massacre mexe com esta ficha em três lugares: o +6 nas rolagens, a pele de gente e o
     número escrito no Status. js/extase.js é o último script da página, então ele AVISA quando
     chega (ready) e quando o objeto muda de mão; sem esses dois chamamentos, abrir a ficha com o
     colar na mão mostraria a pele velha até a pessoa clicar em qualquer coisa. */
  function aoMudarMassacre() {
    renderAttrs();
    renderForm();
    renderStatus();
  }
  window.addEventListener('eclipse-extase', function (e) {
    if (e && e.detail && e.detail.chave && e.detail.chave !== SAVE_KEY) return;
    aoMudarMassacre();
  });
  window.addEventListener('eclipse-extase-ready', function (e) {
    if (e && e.detail && e.detail.chave && e.detail.chave !== SAVE_KEY) return;
    aoMudarMassacre();
  });
})();

window.__FICHA_OK = true; // a ficha carregou o motor: esconde o aviso de cache velha
