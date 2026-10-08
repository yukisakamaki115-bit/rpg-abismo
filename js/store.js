/* ===== Éclipse — js/store.js: a única porta de entrada e saída dos dados da mesa =====
   Por que ele existe: 9 arquivos chamavam `localStorage` direto e 8 escutavam o evento
   `storage` para ver a mudança vinda de OUTRA aba (é assim que o painel do mestre pinta a
   ficha alheia, e é assim que a aura da Tessalha escuta a pessoa que ela escolheu). Reescrever
   os nove para assíncrono seria reescrever o jogo.

   Então este arquivo não pede mudança nenhuma nos outros: ele **veste o localStorage**.
   - Ler continua síncrono e local (`getItem` intacto) — nenhuma tela espera a rede.
   - Escrever grava local na hora e atravessa para o banco atrás (com fila).
   - O que chega do banco é escrito no cache local e **re-dispara o mesmo `StorageEvent`**
     que uma aba vizinha dispararia. Para o resto do site, a nuvem é só "mais uma aba aberta".

   ─── 06/10, A TROCA DE BANCO (v1.37) ───
   A versão anterior falava com o **Cloud Firestore**. O banco que o mestre criou no console é
   o **Realtime Database** (`ok-banco-de-da-default-rtdb`) — são dois produtos diferentes dentro
   do Firebase, com endereços e APIs diferentes. Medido na rede: o Firestore deste projeto nem
   foi nunca habilitado (403 "API has not been used in project"), e o Realtime Database responde
   200 e está vazio. Enquanto os dois lados não apontassem para o mesmo banco, nenhuma ficha
   atravessava — por isso a tela do mestre não se mexia quando alguém clicava.
   O transporte abaixo é Realtime Database (`firebase/database`), e ele ainda ganha de graça o
   que a gente queria: `onValue` é EMPURRADO pelo servidor. Não é consulta a cada segundo.

   ─── E O LOGIN SAIU DO CAMINHO ───
   Antes a escrita só atravessava depois de `onAuthStateChanged` entregar uma conta. Ninguém
   tinha conta, então nada subia — e "sincroniza quando eu logar" não é "automático". Agora:
   assim que a assinatura com o banco se estabelece, a mesa sincroniza, com conta ou sem conta.
   A conta continua existindo e passa a ser só uma ASSINATURA no campo `por` (quem fez), não uma
   permissão. Sem conta, quem assina é o nome do crachá do salão (`eclipse_eu_v1`), e na falta
   dele `sem-conta`.

   Sem config, sem rede ou sem SDK: modo local puro, exatamente como era antes. O site nunca
   trava por causa do Firebase — ele só para de sincronizar e avisa na tela. */
(function (global) {
  'use strict';

  const CFG = global.FIREBASE_CFG || null;
  const LS = global.localStorage;
  /* Os métodos NATIVOS, amarrados antes de qualquer patch. Isto não é preciosismo:
     `setItem` mora no Storage.prototype, e o patch cria uma propriedade própria no objeto —
     então um `real.setItem` escrito como `function (k,v) { LS.setItem(k,v) }` procura
     `LS.setItem` NA HORA da chamada, acha o patch, chama a si mesmo e estoura a pilha
     (RangeError: Maximum call stack size exceeded). Com `.bind(LS)` o alvo congela no
     método original do navegador e o vestido senta por cima sem engolir a si próprio. */
  const real = {
    getItem: LS.getItem.bind(LS),
    setItem: LS.setItem.bind(LS),
    removeItem: LS.removeItem.bind(LS),
    key: LS.key.bind(LS)
  };

  /* Chaves que NÃO sobem de propósito: são do aparelho, não da mesa. Tema escolhido,
     login local antigo, "quem sou eu nesta máquina", a conta e a fila do próprio sync. */
  const SO_LOCAIS = {
    eclipse_theme: 1, eclipse_login: 1, eclipse_eu_v1: 1,
    eclipse_conta_v1: 1, eclipse_conta_email_v1: 1, eclipse_sync_fila_v1: 1,
    eclipse_aparelho_v1: 1, eclipse_aliados_v1: 1
  };
  /* Históricos que crescem para sempre no navegador: a nuvem recebe só o rabo da lista
     (o local continua com o que já tinha). Sem teto aqui, uma sessão longa de rolagens
     passava a tarde inteira subindo o mesmo log gigante em toda escrita. */
  const TRUNCAR = { eclipse_roll_log: 120, eclipse_activity: 200, eclipse_mestre_log: 200 };
  /* Retrato (a foto em base64 que o editor grava) não viaja no nó `chaves`: ele mora no nó
     `retratos` e no `chaves` fica só um bilhete `{stub:1, ts, len}`. Motivo: a assinatura do
     `chaves` é UMA descida só no abrir da página — se cada retrato de vários megabytes estivesse
     dentro dela, todo mundo baixaria todas as fotos de todo mundo em toda aba, e a tela que a
     gente acabou de desengravatar ficaria pesada de novo. O bilhete é barato; a foto só é buscada
     quando o `ts` dela é novo. */
  const RETRATO = /_portrait$/;
  const MAX_DOC = 700 * 1024;      // chars: acima disto, mesmo não sendo retrato, vira bilhete + foto no nó retratos
  /* Teto do nó `retratos`. O Realtime Database não reclama com delicadeza: um valor gigante
     faz a escrita falhar no meio e o jogador vê só o spinner. Foto de celular no editor de
     retrato passa de 6 MB de base64 fácil, então avisamos ANTES de tentar, em português. */
  const MAX_RETRATO = 6 * 1024 * 1024;
  const FILA_KEY = 'eclipse_sync_fila_v1';
  const ESPERA = 400;              // ms de debounce por chave
  const ESPERA_SNAPSHOT = 6000;    // ms máximos esperando o banco responder antes de assumir o vazio

  /* ---------- presença: quem está de ficha aberta AGORA ----------
     A presença NÃO passa pelo vestido de `chaves` de propósito, e o motivo é de conta: a
     assinatura do vestido é do nó `chaves` INTEIRO. Se o batimento (uma vez a cada 15 s por
     aba) fosse uma chave lá dentro, cada aba obrigaria o banco a reenviar a mesa inteira —
     seis fichas, retratos e logs — para todo mundo, o dia todo. O nó `presenca` é separado,
     minúsculo (umas dezenas de bytes por pessoa) e só assina quem está olhando.
     Sem nuvem, o espelho deste navegador (`eclipse_presenca_<id>`, chave que nunca sobe) faz o
     mesmo serviço entre abas da mesma máquina — é assim que a mesa se vê funcionando num
     `file://` com cinco abas abertas, sem banco no meio. */
  const APARELHO_KEY = 'eclipse_aparelho_v1';
  const PRES_PREFIX = 'eclipse_presenca_';
  const BATIMENTO = 15000;   // de quanto em quanto tempo eu aviso "continuo aqui"
  const VIDA_PRES = 50000;   // 3 batimentos sem notícia: a pessoa fechou a página

  const L = {
    nuvem: false,       // SDK carregou
    pronto: false,      // assinatura com o banco de pé (era aqui que o login morava; não mora mais)
    snapshot: false,    // a primeira resposta do banco já chegou
    quem: '',           // e-mail logado (opcional, desde a v1.37)
    uid: '',            // uid da conta, quando existe
    erro: '',           // última falha vista (mostrada na tela, não escondida em console)
    naVem: 0,           // quantas chaves a mesa tem no banco
    conflito: 0         // vezes que tínhamos escrita suja quando o banco chegou por cima
  };
  const tsVisto = {};   // chave -> carimbo do último valor aplicado daqui
  const sujo = {};      // chave -> true enquanto há escrita nossa aguardando o banco
  const naNuvem = {};   // chave -> ts que o banco nos mostrou na última assinatura (serve para ver o que foi APAGADO lá)
  const semente = {};   // chave -> o que existia LOCAL quando esta página abriu (antes de qualquer código rodar)
  let escrevendo = false; // guarda: aplicar remoto não pode re-empurrar para o banco
  const timer = {};

  /* A semente é lida AGORA, na primeira linha útil do arquivo, antes de qualquer ficha,
     painel ou motor rodar. É ela que deixa a gente distinguir "o jogador mexeu em algo"
     de "o motor acabou de criar o estado padrão numa máquina que chegou vazia" — e é isso
     que impede uma máquina nova de subir defaults por cima da ficha real da mesa. */
  (function semear() {
    for (let i = 0; i < LS.length; i++) {
      const k = real.key(i);
      if (ehDaMesa(k)) semente[k] = real.getItem(k);
    }
  })();

  function ehDaMesa(chave) {
    /* Allowlist por prefixo, e não lista de exceto. Motivo medido no ar: o próprio SDK do
       Firebase escreve no localStorage (`__sak`, `firebase:authUser:<apiKey>:[DEFAULT]`), e
       com a peneira aberta pelo lado de fora a gente ia criar nó no banco chamado
       `firebase:authUser:AIzaSy…`. Tudo que o site salva começa com `eclipse_`; o resto não é
       negócio nosso e fica quieto no aparelho de quem escreveu. */
    return !!chave && chave.indexOf('eclipse_') === 0 && !SO_LOCAIS[chave] && chave !== FILA_KEY &&
      chave.indexOf(PRES_PREFIX) !== 0;
  }
  function log(txt) { if (global.console && console.info) console.info('[sync] ' + txt); }
  function warn(txt, e) { if (global.console && console.warn) console.warn('[sync] ' + txt, e || ''); }

  /* ---------- a fila (sobrevive a F5 e a queda de Wi-Fi) ---------- */
  function lerFila() {
    try { const f = JSON.parse(real.getItem(FILA_KEY) || '{}'); return (f && typeof f === 'object') ? f : {}; }
    catch (e) { return {}; }
  }
  /* Limpesa de boot: se uma versão anterior chegou a enfileirar coisa que não é da mesa,
     ela sai da fila sem nunca ter subido — e sem tocar no valor local de ninguém. */
  function faxinaFila() {
    const f = lerFila();
    let mexeu = false;
    Object.keys(f).forEach(function (k) { if (!ehDaMesa(k)) { delete f[k]; mexeu = true; } });
    if (mexeu) escreverFila(f);
    return mexeu;
  }
  function escreverFila(f) { try { real.setItem(FILA_KEY, JSON.stringify(f)); } catch (e) {} }
  function marcar(chave, acao) {
    if (!ehDaMesa(chave)) return;
    /* Nuvem desligada — sem config, `ativo: false`, ou o `?nuvem=local` da URL (v1.41): não
       enfileira NADA. Sem esta linha a fila `eclipse_sync_fila_v1` ia crescendo com escrita que
       nunca sobe (o `enviar` devolve cedo quando não há `fb`), e a máquina que ligasse a nuvem
       mais tarde despejaria laboratório velho no banco da mesa. Modo local é local de verdade,
       não "empurrado para sempre". */
    if (!CFG || !CFG.ativo) return;
    const f = lerFila();
    f[chave] = { acao: acao, ts: Date.now() };
    escreverFila(f);
    sujo[chave] = true;
    agendar(chave);
  }
  function desmarcar(chave) {
    const f = lerFila();
    if (f[chave]) { delete f[chave]; escreverFila(f); }
    delete sujo[chave];
  }
  function agendar(chave) {
    if (timer[chave]) clearTimeout(timer[chave]);
    timer[chave] = setTimeout(function () { delete timer[chave]; enviar(chave); }, ESPERA);
  }

  /* ---------- o vestido: patch do setItem / removeItem ----------
     Se o navegador não deixar encostar (algum modo privado mais bravo), o site simplesmente
     continua sendo o que sempre foi: local. Nada aqui é condição para o jogo funcionar. */
  try {
    /* `defineProperty` com `enumerable: false`: atribuir direto (`LS.setItem = fn`) cria
       propriedade enumerável no objeto, e aí `Object.keys(localStorage)` passa a devolver
       `["setItem","removeItem", …]` junto das chaves de verdade. O vestido tem que ser
       invisível para quem olha a lista. */
    const Vestido = function (nome, fn) {
      Object.defineProperty(LS, nome, { value: fn, writable: true, configurable: true, enumerable: false });
    };
    Vestido('setItem', function (chave, valor) {
      real.setItem(chave, valor);              // o jogo nunca espera a rede
      if (!escrevendo && ehDaMesa(chave)) marcar(chave, 'set');
    });
    Vestido('removeItem', function (chave) {
      real.removeItem(chave);
      if (!escrevendo && ehDaMesa(chave)) marcar(chave, 'del');
    });
  } catch (e) {
    warn('não consegui vestir o localStorage (sigo só local): ' + (e && e.message));
  }

  function aplicarLocal(chave, texto, ts) {
    const atual = real.getItem(chave);
    tsVisto[chave] = ts || 0;
    if (atual === texto) { desmarcarSilencioso(chave); return; }
    escrevendo = true;
    try {
      if (texto === null || texto === undefined) real.removeItem(chave);
      else real.setItem(chave, texto);
    } finally { escrevendo = false; }
    /* A mesma mensagem que o navegador manda quando OUTRA aba mexe na chave. É por ela que o
       painel do mestre repinta o card, a ficha da Vesper refaz a lista de inimigos, a aura da
       Tessalha ecoa a cura de quem ela escolheu, e a ficha que tem retrato repinta o retrato
       (`ficha-comum.js` escuta exatamente `<chave>_portrait`). Sem este despacho, nada no site
       muda de tela — e era essa a reclamação: "clica lá e não muda aqui". */
    let ev = null;
    try { ev = new StorageEvent('storage', { key: chave, newValue: texto, oldValue: atual, storageArea: LS }); }
    catch (e) { try { ev = new StorageEvent('storage', { key: chave, newValue: texto, oldValue: atual }); } catch (e2) {} }
    if (ev) global.dispatchEvent(ev);
  }
  function desmarcarSilencioso(chave) {
    // chegou do banco igual ao que tínhamos: não é mais pendência nossa
    if (sujo[chave] && semente[chave] !== null) desmarcar(chave);
  }

  /* ---------- Firebase (carrega sozinho; se não der, o site segue local) ---------- */
  let fb = null;

  /* O endereço do Realtime Database. Se um dia o `databaseURL` sumir da config (acontece: o
     bloco que o console copia é gravado ANTES de existir banco, e fica sem a linha), a gente
     reconstrói o padrão do projeto em vez de desligar a nuvem em silêncio. */
  function urlDoBanco() {
    if (CFG && CFG.databaseURL) return CFG.databaseURL;
    if (CFG && CFG.projectId) return 'https://' + CFG.projectId + '-default-rtdb.firebaseio.com';
    return undefined;
  }

  async function subirSDK() {
    const v = (CFG && CFG.sdk) || '12.0.0';
    const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    const appMod = await import(base + 'firebase-app.js');
    const dbMod = await import(base + 'firebase-database.js');
    const a = appMod.initializeApp(CFG);
    fb = {
      db: dbMod,
      d: dbMod.getDatabase(a, urlDoBanco()),
      auth: null, a: null
    };
    /* Auth é opcional desde a v1.37: ela só serve para assinar quem mexeu e para o painel de
       conta. Se ela não carregar (método de login desligado no console, por exemplo), o sync
       continua — apenas assinando com o nome do crachá. */
    try {
      const authMod = await import(base + 'firebase-auth.js');
      fb.auth = authMod;
      fb.a = authMod.getAuth(a);
    } catch (e) { log('auth não carregou (sigo assinando com o crachá): ' + (e && e.message)); }
  }

  function refChaves() { return fb.db.ref(fb.d, 'mesas/' + CFG.mesa + '/chaves'); }
  function refChave(chave) { return fb.db.ref(fb.d, 'mesas/' + CFG.mesa + '/chaves/' + chave); }
  function refRetrato(chave) { return fb.db.ref(fb.d, 'mesas/' + CFG.mesa + '/retratos/' + chave); }

  /* Quem assina a escrita: a conta se houver; senão o nome digitado no salão; senão `sem-conta`.
     É metadado de leitura humana ("o que o mestre viu na tela"), não chave de permissão. */
  function quemAssina() {
    if (L.uid) return L.uid;
    if (L.quem) return L.quem;
    try {
      const e = JSON.parse(real.getItem('eclipse_eu_v1') || 'null');
      if (e && typeof e.nome === 'string' && e.nome.trim()) return e.nome.trim().slice(0, 40);
    } catch (x) {}
    return 'sem-conta';
  }

  function aparar(chave, texto) {
    if (!TRUNCAR[chave]) return texto;
    try {
      const arr = JSON.parse(texto);
      if (Array.isArray(arr) && arr.length > TRUNCAR[chave]) return JSON.stringify(arr.slice(0, TRUNCAR[chave]));
    } catch (e) {}
    return texto;
  }

  /* ---------- a subida ---------- */
  async function enviar(chave) {
    if (!fb || !L.pronto) return;
    const f = lerFila();
    const item = f[chave];
    if (!item) return;

    /* Máquina nova abrindo uma ficha que já existe na mesa: o motor escreve o estado padrão
       no primeiro segundo (matrícula, migrações). Se a gente mandasse isso agora, apagava a
       ficha real de quem já jogou. Então: espera o banco responder primeiro — e quando ele
       responde, o valor dele é escrito AQUI e a pendência morre sozinha, igual por igual. */
    if (semente[chave] === null && item.acao === 'set' && !L.snapshot) {
      if (Date.now() - (item.ts || 0) < ESPERA_SNAPSHOT) { agendar(chave); return; }
    }

    try {
      if (item.acao === 'del') {
        await fb.db.remove(refChave(chave));
        if (RETRATO.test(chave)) await fb.db.remove(refRetrato(chave));
      } else {
        const texto = real.getItem(chave);
        if (texto === null) { desmarcar(chave); return; }
        await poeNoBanco(chave, texto);
      }
      desmarcar(chave);
      L.erro = '';
    } catch (e) {
      L.erro = nomeErro(e);
      warn('não conseguiu subir ' + chave + ': ' + L.erro);
    }
    avisar();
  }

  /* Uma escrita, dois formatos: o valor direto no `chaves`, ou (retrato / coisa gigante) um
     bilhete no `chaves` e o corpo no `retratos`. O bilhete é o que a assinatura vê barato. */
  async function poeNoBanco(chave, texto) {
    const valor = aparar(chave, texto);
    if (valor.length > MAX_RETRATO) {
      throw new Error('isso é grande demais para o banco (' + Math.round(valor.length / 1048576) +
        ' MB). Na ficha, abra o retrato e escolha uma foto menor (ou use \"Reduzir\" antes de salvar).');
    }
    const ts = Date.now(), por = quemAssina();
    /* O carimbo é registrado ANTES da espera. Motivo: o `onValue` costuma receber o NOSSO
       próprio eco de volta antes do `await` do `set` resolver, e aí a assinatura vê uma chave
       marcada como suja e conta "conflito" — um contador que não contava briga nenhuma, só o
       eco de nós mesmos (medido: um clique no salão dava conflito 1). Reconhecendo o carimbo
       antes, o eco cai no `data.ts <= tsVisto[chave]` lá embaixo e a tela nem pisca. */
    tsVisto[chave] = ts;
    naNuvem[chave] = ts;
    if (RETRATO.test(chave) || valor.length > MAX_DOC) {
      await fb.db.set(refRetrato(chave), { v: valor, ts: ts, por: por });
      await fb.db.set(refChave(chave), { stub: 1, ts: ts, por: por, len: valor.length });
    } else {
      await fb.db.set(refChave(chave), { v: valor, ts: ts, por: por });
    }
  }

  /* ---------- a descida (o que faz a tela do mestre se mexer sozinha) ---------- */
  let escutando = false;
  function assinar() {
    if (!fb || escutando) return;
    escutando = true;
    fb.db.onValue(refChaves(), function (snap) {
      /* Cada resposta prova que o link está vivo — inclusive depois de uma queda, quando o
         `setTimeout` lá embaixo remonta a assinatura. Sem esta linha, a primeira falha de rede
         deixava `pronto` falso para sempre: a tela continuava bonita e NADA subia mais até o F5. */
      L.pronto = true;
      const dados = (snap && snap.exists && snap.exists()) ? (snap.val() || {}) : {};
      const vistos = {};
      L.snapshot = true;
      L.naVem = Object.keys(dados).length;
      Object.keys(dados).forEach(function (chave) {
        if (!ehDaMesa(chave)) return;
        const data = dados[chave] || {};
        vistos[chave] = data.ts || 0;
        naNuvem[chave] = data.ts || 0;
        if (tsVisto[chave] && data.ts && data.ts <= tsVisto[chave]) return;   // foi a gente que escreveu
        if (sujo[chave]) L.conflito++;
        if (data.stub) {
          // bilhete: a foto mora em outro nó, e só agora alguém vai buscar por ela
          fb.db.get(refRetrato(chave)).then(function (r) {
            const corpo = r && r.exists && r.exists() ? r.val() : null;
            if (corpo && typeof corpo.v === 'string') aplicarLocal(chave, corpo.v, data.ts || 0);
            else if (corpo && typeof corpo === 'string') aplicarLocal(chave, corpo, data.ts || 0); // retrato antigo, sem envelope
            avisar();
          }).catch(function (e) { L.erro = nomeErro(e); warn('não consegui baixar o retrato: ' + L.erro); avisar(); });
        } else if (typeof data.v === 'string') {
          aplicarLocal(chave, data.v, data.ts || 0);
        }
      });
      /* O que o banco NÃO tem mais, a mesa também não tem: é assim que um "soltar personagem",
         um "apagar inimigo" ou um "limpar histórico" feito noutra máquina aparece aqui. Só apago
         chave que um dia EU vi vir do banco — senão uma máquina nova apagaria a ficha local antes
         de ela existir na nuvem. */
      Object.keys(tsVisto).forEach(function (chave) {
        if (!vistos[chave] && naNuvem[chave] !== undefined && sujo[chave] !== true) {
          delete naNuvem[chave];
          aplicarLocal(chave, null, 0);
        }
      });
      avisar();
    }, function (e) {
      L.erro = nomeErro(e);
      L.pronto = false;
      escutando = false;
      warn('assinatura caiu: ' + L.erro);
      avisar();
      // volta sozinho: sem isto, uma queda de rede de 2 segundos mataria o sync até o F5
      setTimeout(function () {
        if (escutando) return;
        try { assinar(); } catch (x) { L.erro = nomeErro(x); avisar(); }
        if (L.pronto) flush();  // o que se acumulou durante a queda sobe na ordem da fila
      }, 4000);
    });
  }

  /* ---------- conta (opcional, desde a v1.37: é assinatura, não permissão) ---------- */
  function ouvirAuth() {
    if (!fb || !fb.auth || !fb.a) return;
    try {
      fb.auth.onAuthStateChanged(fb.a, function (u) {
        if (u) {
          L.quem = u.email || u.uid;
          L.uid = u.uid || '';
          try { real.setItem('eclipse_conta_v1', JSON.stringify({ email: u.email, uid: u.uid, ts: Date.now() })); } catch (e) {}
        } else {
          L.quem = '';
          L.uid = '';
        }
        avisar();
      });
    } catch (e) { log('auth indisponível: ' + (e && e.message)); }
  }

  /* Mensagem que o jogador lê, não código que ele decifra. */
  function nomeErro(e) {
    const c = String((e && (e.code || (e.customData && e.customData.code))) || '');
    const m = (e && e.message) ? String(e.message) : String(e);
    const t = (c + ' ' + m).toLowerCase();
    if (t.indexOf('permission-denied') !== -1) {
      return 'o banco recusou a escrita — as regras do Realtime Database (console → Realtime Database → Regras) não estão deixando';
    }
    if (t.indexOf('network-request-failed') !== -1 || t.indexOf('unavailable') !== -1) {
      return 'sem internet para falar com o banco agora — o jogo continua local e sincroniza quando voltar';
    }
    if (t.indexOf('invalid-api-key') !== -1 || t.indexOf('api-key-not-valid') !== -1) return 'a apiKey da config não é deste projeto';
    if (t.indexOf('configuration-not-found') !== -1 || t.indexOf('operation-not-allowed') !== -1) {
      return 'login por e-mail e senha está DESLIGADO no console (Authentication → Sign-in method) — o sync funciona sem conta, isto só afeta a conta';
    }
    if (t.indexOf('user-not-found') !== -1 || t.indexOf('wrong-password') !== -1 || t.indexOf('invalid-credential') !== -1) return 'e-mail ou senha não conferem';
    if (t.indexOf('email-already-in-use') !== -1) return 'esse e-mail já tem conta nesta mesa';
    if (t.indexOf('invalid-email') !== -1) return 'e-mail inválido';
    return m.slice(0, 180);
  }

  /* ---------- a presença em si ---------- */
  const P = { meu: null, peers: {}, ouvintes: [], timer: 0, assinado: false, cracha: '', fonte: null };
  /* Os quatro números que a mini-aba de aliados mostra. Vão no bilhete de presença como CÓPIA
     barata: a fonte verdadeira é a ficha sincronizada (que qualquer aparelho da mesa já tem no
     cache local), mas se ela ainda não desceu do banco, o batimento responde a pergunta sozinha. */
  const VITAIS_PRES = ['hp', 'hpMax', 'san', 'sanMax'];

  function idDoAparelho() {
    if (P.cracha) return P.cracha;
    let id = '';
    /* sessionStorage e NÃO localStorage: as duas abas do mesmo navegador precisam de dois
       crachás diferentes, senão uma escreve por cima da presença da outra e o mestre vê menos
       gente do que realmente está na mesa. Sem sessionStorage (modo privado bravo), o crachá
       vive só na memória desta aba — que é exatamente o que uma presença deve ser. */
    try { id = (global.sessionStorage && sessionStorage.getItem(APARELHO_KEY)) || ''; } catch (e) { id = ''; }
    if (!id) {
      id = 'p' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      try { sessionStorage.setItem(APARELHO_KEY, id); } catch (e) {}
    }
    P.cracha = id;
    return id;
  }

  function refPresenca(id) {
    return fb.db.ref(fb.d, 'mesas/' + CFG.mesa + '/presenca' + (id ? '/' + id : ''));
  }

  /* Uma escrita de presença é descartável: se ela falhar, o próximo batimento cobre. Por isso
     nada aqui entra na fila, não mostra erro na tela e não segura ninguém. */
  function registrar(entry) {
    try { real.setItem(PRES_PREFIX + entry.id, JSON.stringify(entry)); } catch (e) {}
    if (fb && L.pronto && CFG && CFG.mesa) {
      try { fb.db.set(refPresenca(entry.id), entry).catch(function () {}); } catch (e) {}
    }
  }

  /* As abas que fecharam sem dizer tchau deixam o espelho local para trás (o navegador não apaga
     o que a gente escreveu). A limpeza roda uma vez por página, no primeiro batimento. */
  function faxinaPresenca() {
    const agora = Date.now();
    let chaves = [];
    try {
      for (let i = 0; i < LS.length; i++) { const k = real.key(i); if (k && k.indexOf(PRES_PREFIX) === 0) chaves.push(k); }
    } catch (e) { return; }
    chaves.forEach(function (k) {
      let ts = 0;
      try { ts = Number((JSON.parse(real.getItem(k)) || {}).ts) || 0; } catch (e) { ts = 0; }
      if (!ts || agora - ts > 10 * 60 * 1000) { try { real.removeItem(k); } catch (e) {} }
    });
  }

  function notaPres(e, ts) {
    const out = {
      id: String(e.id),
      quem: String(e.quem || ''),
      ficha: String(e.ficha || ''),
      chave: String(e.chave || ''),
      ts: ts
    };
    VITAIS_PRES.forEach(function (k) {
      const n = Number(e[k]);
      if (isFinite(n) && e[k] !== null && e[k] !== '') out[k] = Math.max(0, Math.round(n));
    });
    return out;
  }

  /* `meta` é o que a página sabe sobre si: {quem, ficha, chave, hp, hpMax, san, sanMax}.
     Quando a ficha registra `onPulso`, é a fonte dela que manda o meta em cada batimento —
     senão o `setInterval` de 15 s reempurraria para sempre a vida que ela tinha na hora em que
     a página abriu, e a mesa inteira mostraria número velho. */
  function pulsar(meta) {
    if (P.fonte) { try { meta = P.fonte() || meta; } catch (e) {} }
    meta = meta || {};
    let quem = meta.quem || '';
    if (!quem) {
      try {
        const e = JSON.parse(real.getItem('eclipse_eu_v1') || 'null');
        if (e && typeof e.nome === 'string') quem = e.nome.trim();
      } catch (x) {}
    }
    const novo = {
      quem: String(quem).slice(0, 40),
      ficha: String(meta.ficha || (global.location && String(location.pathname).split('/').pop()) || '').slice(0, 24),
      chave: String(meta.chave || '').slice(0, 40)
    };
    VITAIS_PRES.forEach(function (k) { if (meta[k] !== undefined && meta[k] !== null && meta[k] !== '') novo[k] = meta[k]; });
    novo.id = idDoAparelho();
    novo.ts = Date.now();
    P.meu = novo;
    registrar(P.meu);
    if (!P.timer) { faxinaPresenca(); P.timer = setInterval(function () { if (P.meu) pulsar(P.meu); }, BATIMENTO); }
    avisarPresenca();
    return P.meu;
  }

  function limparPresenca() {
    if (!P.meu) return;
    try { real.removeItem(PRES_PREFIX + P.meu.id); } catch (e) {}
    if (fb && L.pronto && CFG && CFG.mesa) {
      try { fb.db.remove(refPresenca(P.meu.id)); } catch (e) {}
    }
  }

  /* Os colegas vivos: o que o banco mostrou + o espelho das outras abas desta máquina, deduzido
     pelo crachá (a mesma pessoa nos dois lados conta uma vez só) e cortado por idade. */
  function colegas() {
    const agora = Date.now(), vistos = {}, out = [];
    function aceito(e) {
      if (!e || typeof e !== 'object' || !e.id || e.id === idDoAparelho()) return;
      const ts = Number(e.ts) || 0;
      if (!ts || agora - ts > VIDA_PRES) return;
      const a = vistos[e.id];
      if (a) {
        if (ts <= a.ts) return;
        /* O mesmo crachá chega de dois lados (nuvem + espelho desta máquina) e em ordem qualquer:
           campo que o bilhete mais novo não traz não apaga o que o mais velho trouxe. */
        const novo = notaPres(e, ts);
        ['quem', 'ficha', 'chave'].forEach(function (k) { if (!novo[k]) novo[k] = a[k]; });
        VITAIS_PRES.forEach(function (k) { if (novo[k] === undefined) novo[k] = a[k]; });
        vistos[e.id] = novo;
        return;
      }
      vistos[e.id] = notaPres(e, ts);
    }
    Object.keys(P.peers).forEach(function (id) { aceito(P.peers[id]); });
    try {
      for (let i = 0; i < LS.length; i++) {
        const k = real.key(i);
        if (k && k.indexOf(PRES_PREFIX) === 0) {
          let e = null;
          try { e = JSON.parse(real.getItem(k)); } catch (x) { e = null; }
          aceito(e);
        }
      }
    } catch (e) {}
    Object.keys(vistos).forEach(function (id) { out.push(vistos[id]); });
    out.sort(function (a, b) { return String(a.chave || a.ficha).localeCompare(String(b.chave || b.ficha)); });
    return out;
  }

  function avisarPresenca() {
    const lista = colegas();
    P.ouvintes.forEach(function (f) { try { f(lista); } catch (e) {} });
  }

  function assinarPresenca() {
    if (!fb || !CFG || !CFG.mesa || P.assinado) return;
    P.assinado = true;
    try {
      fb.db.onValue(refPresenca(''), function (snap) {
        P.peers = (snap && snap.exists && snap.exists()) ? (snap.val() || {}) : {};
        avisarPresenca();
      }, function () {
        P.assinado = false;
        setTimeout(function () { if (!P.assinado) assinarPresenca(); }, 5000);
      });
      /* Fechar a aba tira o crachá do quadro na hora, sem esperar os 50 s de validade. É um
         enfeite: se o navegador não deixar registrar, o corte por idade faz o serviço depois. */
      try { fb.db.onDisconnect(refPresenca(idDoAparelho())).remove().catch(function () {}); } catch (e) {}
    } catch (e) { P.assinado = false; }
  }

  /* ---------- ligações de fora ---------- */
  const ouvintes = [];
  function avisar() {
    const s = API.status();
    ouvintes.forEach(function (f) { try { f(s); } catch (e) {} });
  }

  async function ligar() {
    if (!CFG || !CFG.ativo || !CFG.projectId) { L.erro = ''; return; }
    try {
      await subirSDK();
      L.nuvem = true;
    } catch (e) {
      L.nuvem = false;
      L.erro = nomeErro(e);
      log('SDK não veio (site segue local): ' + L.erro);
      avisar();
      return;
    }
    ouvirAuth();
    /* A assinatura abre NA HORA, sem esperar conta. É esta linha que responde o "faz tudo
       automático": enquanto ela estiver de pé, o que o outro lado mexe chega aqui sozinho. */
    try {
      assinar();
      L.pronto = true;
    } catch (e) {
      L.pronto = false;
      L.erro = nomeErro(e);
      warn('não consegui assinar o banco: ' + L.erro);
    }
    assinarPresenca();
    flush();
    avisar();
  }

  async function garantirSDK() {
    if (fb) return;
    if (!CFG || !CFG.ativo) throw new Error('este site está em modo local (sem Firebase ligado)');
    await subirSDK();
    L.nuvem = true;
    if (!L.pronto) { try { assinar(); L.pronto = true; } catch (e) {} }
  }

  async function entrar(email, senha) {
    await garantirSDK();
    if (!fb.auth) throw new Error('login indisponível neste projeto (ative Authentication → Sign-in method no console)');
    const c = await fb.auth.signInWithEmailAndPassword(fb.a, String(email).trim(), senha);
    return c.user;
  }
  async function criar(email, senha) {
    await garantirSDK();
    if (!fb.auth) throw new Error('login indisponível neste projeto (ative Authentication → Sign-in method no console)');
    const c = await fb.auth.createUserWithEmailAndPassword(fb.a, String(email).trim(), senha);
    try { if (c.user && c.user.updateProfile) await c.user.updateProfile({ displayName: String(email).split('@')[0] }); } catch (e) {}
    return c.user;
  }
  async function sair() {
    if (!fb || !fb.auth) return;
    await fb.auth.signOut(fb.a);
    L.quem = ''; L.uid = '';
    try { real.removeItem('eclipse_conta_v1'); } catch (e) {}
    /* Sair NÃO desliga o sync: a mesa continua sincronizando assinada pelo crachá. */
    avisar();
  }

  /* ---------- o que a tela do mestre usa ---------- */
  async function flush() {
    if (!fb || !L.pronto) return 0;
    const f = lerFila();
    const chaves = Object.keys(f).sort(function (a, b) { return (f[a].ts || 0) - (f[b].ts || 0); });
    for (let i = 0; i < chaves.length; i++) { await enviar(chaves[i]); }
    return chaves.length;
  }

  /* Sobe o que ESTA máquina tem AGORA para o banco, uma vez. É o "passar todas as fichas pro
     Firebase" que ele pediu. Existe separada do flush porque aqui a ordem é a contrária
     (o local manda, o banco aceita) e só quem é dono da mesa aperta este botão. */
  async function subirTudo(forcar) {
    await garantirSDK();
    if (!L.pronto) throw new Error('o banco ainda não respondeu — espere o chip ficar verde e tente de novo');
    const relatorio = [];
    const chaves = [];
    for (let i = 0; i < LS.length; i++) { const k = real.key(i); if (ehDaMesa(k)) chaves.push(k); }
    for (let i = 0; i < chaves.length; i++) {
      const chave = chaves[i];
      const texto = real.getItem(chave);
      if (texto === null) continue;
      if (!forcar && tsVisto[chave]) { relatorio.push({ chave: chave, foi: false, nota: 'já veio do banco' }); continue; }
      try {
        const valor = aparar(chave, texto);
        await poeNoBanco(chave, texto);
        relatorio.push({ chave: chave, foi: true, bytes: valor.length, nota: (RETRATO.test(chave) || valor.length > MAX_DOC) ? 'foto no nó retratos' : '' });
      } catch (e) {
        relatorio.push({ chave: chave, foi: false, nota: nomeErro(e) });
      }
    }
    L.snapshot = true;
    avisar();
    return relatorio;
  }

  /* Backup completo em string, para baixar ANTES de qualquer virada de banco. */
  function dump() {
    const o = { mesa: (CFG && CFG.mesa) || '-', ts: Date.now(), por: quemAssina(), chaves: {} };
    for (let i = 0; i < LS.length; i++) {
      const k = real.key(i);
      if (ehDaMesa(k)) o.chaves[k] = real.getItem(k);
    }
    return JSON.stringify(o);
  }

  function pendentes() { return Object.keys(lerFila()).length; }

  const API = {
    get: function (k) { try { const r = real.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    set: function (k, v) { LS.setItem(k, JSON.stringify(v)); },
    remove: function (k) { LS.removeItem(k); },
    bruto: real.getItem,
    status: function () {
      return {
        /* 'nuvem' = a assinatura com o banco está de pé (com ou sem conta).
           'local'  = sem config, sem SDK ou sem banco: o jogo continua igual, só não atravessa. */
        modo: (!CFG || !CFG.ativo) ? 'local' : (L.pronto ? 'nuvem' : 'local'),
        banco: 'realtime',
        conta: L.quem || '',          // '' = ninguém logado; o sync não liga para isso
        online: global.navigator ? global.navigator.onLine !== false : true,
        quem: L.quem || quemAssina(), erro: L.erro, pendentes: pendentes(),
        mesa: (CFG && CFG.mesa) || '-', conflito: L.conflito, naVem: L.naVem, snapshot: L.snapshot
      };
    },
    entrar: entrar, criar: criar, sair: sair, flush: flush, subirTudo: subirTudo, dump: dump,
    onStatus: function (f) { if (typeof f === 'function') { ouvintes.push(f); try { f(API.status()); } catch (e) {} } },
    daMesa: ehDaMesa,
    /* presença: `pulsar` abre o batimento desta aba, `colegas` lê a lista viva, `onPresenca`
        é avisado toda vez que ela muda. Quem não chama `pulsar` não aparece para ninguém. */
    pulsar: pulsar, colegas: colegas, aparelho: idDoAparelho,
    /* A página registra de onde vem o batimento (a ficha devolve o meta fresco a cada 15 s).
       `sairDaMesa` é o tchau explícito de quem quer sumir do quadro antes de fechar a aba. */
    onPulso: function (f) { P.fonte = (typeof f === 'function') ? f : null; },
    sairDaMesa: limparPresenca,
    onPresenca: function (f) {
      if (typeof f !== 'function') return;
      P.ouvintes.push(f);
      try { f(colegas()); } catch (e) {}
    },
    ligar: ligar
  };

  global.ECLIPSE_STORE = API;
  global.__STORE_OK = true;

  if (global.addEventListener) {
    global.addEventListener('online', function () { if (!L.pronto) { try { assinar(); L.pronto = true; } catch (e) {} } flush(); avisar(); });
    global.addEventListener('offline', function () { avisar(); });
    /* Aba que ficou na gaveta: o navegador segura os `setTimeout` de quem está escondido, e a
       fila ficava esperando você voltar para ela existir. Ao voltar para a tela, empurra tudo. */
    global.addEventListener('visibilitychange', function () {
      if (global.document && document.visibilityState === 'visible' && L.pronto) flush();
    });
    /* Outra aba desta máquina bateu o ponto: a lista de colegas mudou sem o banco ter dito nada. */
    global.addEventListener('storage', function (e) {
      if (e && e.key && e.key.indexOf(PRES_PREFIX) === 0) avisarPresenca();
    });
    /* `pagehide` é o evento que dispara de verdade no fechar da aba (e no voltar do histórico);
       `unload` já foi declarado morte em todo lugar. */
    global.addEventListener('pagehide', limparPresenca);
  }
  faxinaFila();
  ligar();
})(window);
