/* ===== Éclipse — js/store.js: a única porta de entrada e saída dos dados da mesa =====
   Por que ele existe: 9 arquivos chamavam `localStorage` direto e 8 escutavam o evento
   `storage` para ver a mudança vinda de OUTRA aba (é assim que o painel do mestre pinta a
   ficha alheia, e é assim que a aura da Tessalha escuta a pessoa que ela escolheu). Reescrever
   os nove para assíncrono seria reescrever o jogo.

   Então este arquivo não pede mudança nenhuma nos outros: ele **veste o localStorage**.
   - Ler continua síncrono e local (`getItem` intacto) — nenhuma tela espera a rede.
   - Escrever grava local na hora e atravessa para o Firestore atrás (com fila).
   - O que chega do Firestore é escrito no cache local e **re-dispara o mesmo `StorageEvent`**
     que uma aba vizinha dispararia. Para o resto do site, a nuvem é só "mais uma aba aberta".

   Sem config, sem rede, sem conta ou sem SDK: modo local puro, exatamente como era antes.
   O site nunca trava por causa do Firebase — ele só para de sincronizar e avisa na tela. */
(function (global) {
  'use strict';

  const CFG = global.FIREBASE_CFG || null;
  const LS = global.localStorage;
  /* Os métodos NATIVOS, amarrados antes de qualquer patch. Isto não é preciosismo:
     `setItem` mora no Storage.prototype, e o patch cria uma propriedade própria no objeto —
     então um `real.setItem` escrito como `function (k,v) { LS.setItem(k,v) }` procura
     `LS.setItem` NA HORA da chamada, acha o patch, e chama a si mesmo até estourar a pilha
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
    eclipse_conta_v1: 1, eclipse_conta_email_v1: 1, eclipse_sync_fila_v1: 1
  };
  /* Históricos que crescem para sempre no navegador. O teto do documento do Firestore é
     1 MiB, então a nuvem recebe só o rabo da lista (o local continua com o que já tinha). */
  const TRUNCAR = { eclipse_roll_log: 120, eclipse_activity: 200, eclipse_mestre_log: 200 };
  const MAX_DOC = 700 * 1024;      // chars: margem de segurança bem abaixo de 1 MiB
  const FILA_KEY = 'eclipse_sync_fila_v1';
  const ESPERA = 400;              // ms de debounce por chave
  const ESPERA_SNAPSHOT = 6000;    // ms máximos esperando a nuvem responder antes de assumir o vazio

  const L = {
    nuvem: false,       // SDK carregou
    pronto: false,      // SDK + sessão
    snapshot: false,    // a primeira resposta da nuvem já chegou
    quem: '',           // e-mail logado
    uid: '',            // o uid da conta: é ele que assina o documento (`por`), porque a
                        // firestore.rules confere `por == request.auth.uid` — e e-mail não é uid
    erro: '',           // última falha vista (mostrada na tela, não escondida em console)
    naVem: 0,           // quantas chaves a mesa tem no banco
    conflito: 0         // vezes que tínhamos escrita suja quando a nuvem chegou por cima
  };
  const tsVisto = {};   // chave -> carimbo do último documento aplicado daqui
  const sujo = {};      // chave -> true enquanto há escrita nossa aguardando a nuvem
  const semente = {};   // chave -> o que existia LOCAL quando esta página abriu (antes de qualquer código rodar)
  let escrevendo = false; // guarda: aplicar remoto não pode re-empurrar para a nuvem
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
       com a peneira aberta pelo lado de fora a gente ia criar documento no Firestore chamado
       `firebase:authUser:AIzaSy…`. Tudo que o site salva começa com `eclipse_`; o resto não é
       negócio nosso e fica quieto no aparelho de quem escreveu. */
    return !!chave && chave.indexOf('eclipse_') === 0 && !SO_LOCAIS[chave] && chave !== FILA_KEY;
  }
  function log(txt) { if (global.console && console.info) console.info('[sync] ' + txt); }
  function warn(txt, e) { if (global.console && console.warn) console.warn('[sync] ' + txt, e || ''); }

  /* ---------- a fila (sobrevive a F5 e a queda de Wi-Fi) ---------- */
  function lerFila() {
    try { const f = JSON.parse(real.getItem(FILA_KEY) || '{}'); return (f && typeof f === 'object') ? f : {}; }
    catch (e) { return {}; }
  }
  /* Limpesa de boot: se uma versão anterior chegou a enfileirar coisa que não é da mesa
     (era o caso das chaves internas do SDK, antes do allowlist por prefixo), ela sai da fila
     sem nunca ter subido — e sem tocar no valor local de ninguém. */
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
       painel do mestre repinta o card, a ficha da Vesper refaz a lista de inimigos e a aura da
       Tessalha ecoa a cura de quem ela escolheu. Sem este despacho, nada no site muda de tela. */
    let ev = null;
    try { ev = new StorageEvent('storage', { key: chave, newValue: texto, oldValue: atual, storageArea: LS }); }
    catch (e) { try { ev = new StorageEvent('storage', { key: chave, newValue: texto, oldValue: atual }); } catch (e2) {} }
    if (ev) global.dispatchEvent(ev);
  }
  function desmarcarSilencioso(chave) {
    // chegou da nuvem igual ao que tínhamos: não é mais pendência nossa
    if (sujo[chave] && semente[chave] !== null) desmarcar(chave);
  }

  /* ---------- Firebase (carrega sozinho; se não der, o site segue local) ---------- */
  let fb = null;

  async function subirSDK() {
    const v = (CFG && CFG.sdk) || '12.0.0';
    const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    const app = await import(base + 'firebase-app.js');
    const auth = await import(base + 'firebase-auth.js');
    const fs = await import(base + 'firebase-firestore.js');
    const st = await import(base + 'firebase-storage.js');
    const a = app.initializeApp(CFG);
    fb = {
      auth: auth, fs: fs, st: st,
      a: auth.getAuth(a),
      d: fs.getFirestore(a),
      s: st.getStorage(a)
    };
    // Sem cache do Firestore de propósito: o cache do jogo já é o localStorage, e dois
    // cachezinhos batendo um no outro é história de bug, não de feature.
  }

  function docRef(chave) { return fb.fs.doc(fb.d, 'mesas', CFG.mesa, 'chaves', chave); }
  function colecao() { return fb.fs.collection(fb.d, 'mesas', CFG.mesa, 'chaves'); }
  function caminhoDaChave(chave) { return 'mesas/' + CFG.mesa + '/' + chave + '.json'; }

  async function enviar(chave) {
    if (!fb || !L.pronto) return;
    const f = lerFila();
    const item = f[chave];
    if (!item) return;

    /* Máquina nova abrindo uma ficha que já existe na mesa: o motor escreve o estado padrão
       no primeiro segundo (matrícula, migrações). Se a gente mandasse isso agora, apagava a
       ficha real de quem já jogou. Então: espera a nuvem responder primeiro — e quando ela
       responde, o valor dela é escrito AQUI e a pendência morre sozinha, igual por igual. */
    if (semente[chave] === null && item.acao === 'set' && !L.snapshot) {
      if (Date.now() - (item.ts || 0) < ESPERA_SNAPSHOT) { agendar(chave); return; }
    }

    try {
      if (item.acao === 'del') {
        await fb.fs.deleteDoc(docRef(chave));
      } else {
        const texto = real.getItem(chave);
        if (texto === null) { desmarcar(chave); return; }
        let valor = texto;
        if (TRUNCAR[chave]) {
          try {
            const arr = JSON.parse(texto);
            if (Array.isArray(arr) && arr.length > TRUNCAR[chave]) valor = JSON.stringify(arr.slice(0, TRUNCAR[chave]));
          } catch (e) {}
        }
        const corpo = { ts: Date.now(), por: L.uid || L.quem || 'sem-conta' };
        if (chave.indexOf('_portrait') !== -1 || valor.length > MAX_DOC) {
          const r = fb.st.ref(fb.s, caminhoDaChave(chave));
          await fb.st.uploadString(r, valor, 'raw', { contentType: 'application/json' });
          corpo.__storage = caminhoDaChave(chave);
          corpo.len = valor.length;
        } else {
          corpo.valor = valor; // a string JSON cruza igualzinha ao que estava no navegador
        }
        await fb.fs.setDoc(docRef(chave), corpo);
        tsVisto[chave] = corpo.ts;
      }
      desmarcar(chave);
      L.erro = '';
    } catch (e) {
      L.erro = nomeErro(e);
      warn('não conseguiu subir ' + chave + ': ' + L.erro);
    }
    avisar();
  }

  async function baixarDaNuvem(meta) {
    const url = await fb.st.getDownloadURL(fb.st.ref(fb.s, meta.__storage));
    const r = await fetch(url);
    if (!r.ok) throw new Error('storage: ' + r.status);
    return await r.text(); // o retrato volta como o mesmo JSON que estava no localStorage
  }

  let escutando = false;
  function assinar() {
    if (!fb || escutando) return;
    escutando = true;
    fb.fs.onSnapshot(colecao(), function (snap) {
      L.snapshot = true;
      L.naVem = snap.docs.length;
      snap.docs.forEach(function (d) {
        const chave = d.id, data = d.data() || {};
        if (!ehDaMesa(chave)) return;
        if (tsVisto[chave] && data.ts && data.ts <= tsVisto[chave]) return;   // foi a gente que escreveu
        if (sujo[chave]) L.conflito++;
        if (data.__storage) {
          baixarDaNuvem(data).then(function (texto) {
            aplicarLocal(chave, texto, data.ts || 0);
            avisar();
          }).catch(function (e) { L.erro = nomeErro(e); warn('download do Storage falhou: ' + L.erro); avisar(); });
        } else if (typeof data.valor === 'string') {
          aplicarLocal(chave, data.valor, data.ts || 0);
        }
      });
      avisar();
    }, function (e) {
      L.erro = nomeErro(e);
      L.pronto = false;
      escutando = false;
      warn('assinatura caiu: ' + L.erro);
      avisar();
    });
  }

  /* Mensagem que o jogador lê, não código que ele decifra. */
  function nomeErro(e) {
    const c = String((e && (e.code || (e.customData && e.customData.code))) || '');
    const m = (e && e.message) ? String(e.message) : String(e);
    const t = (c + ' ' + m).toLowerCase();
    if (t.indexOf('permission-denied') !== -1 || t.indexOf('insufficient') !== -1) {
      return 'as regras do Firestore não deixaram esta conta escrever (o firestore.rules ainda não foi colado no console?)';
    }
    if (t.indexOf('network-request-failed') !== -1) return 'sem internet para falar com o Firebase';
    if (t.indexOf('configuration-not-found') !== -1 || t.indexOf('operation-not-allowed') !== -1) {
      return 'login por e-mail e senha está DESLIGADO no console do Firebase (Authentication → Sign-in method)';
    }
    if (t.indexOf('user-not-found') !== -1 || t.indexOf('wrong-password') !== -1 || t.indexOf('invalid-credential') !== -1) return 'e-mail ou senha não conferem';
    if (t.indexOf('email-already-in-use') !== -1) return 'esse e-mail já tem conta nesta mesa';
    if (t.indexOf('invalid-email') !== -1) return 'e-mail inválido';
    if (t.indexOf('unavailable') !== -1) return 'Firestore indisponível agora — o jogo continua local e sincroniza quando voltar';
    return m.slice(0, 180);
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
    fb.auth.onAuthStateChanged(fb.a, function (u) {
      if (u) {
        L.pronto = true;
        L.quem = u.email || u.uid;
        L.uid = u.uid || '';
        try { real.setItem('eclipse_conta_v1', JSON.stringify({ email: u.email, uid: u.uid, ts: Date.now() })); } catch (e) {}
        assinar();
        flush();
      } else {
        L.pronto = false;
        L.quem = '';
        L.uid = '';
      }
      avisar();
    });
    avisar();
  }

  async function garantirSDK() {
    if (fb) return;
    if (!CFG || !CFG.ativo) throw new Error('este site está em modo local (sem Firebase ligado)');
    await subirSDK();
    L.nuvem = true;
  }

  async function entrar(email, senha) {
    await garantirSDK();
    const c = await fb.auth.signInWithEmailAndPassword(fb.a, String(email).trim(), senha);
    return c.user;
  }
  async function criar(email, senha) {
    await garantirSDK();
    const c = await fb.auth.createUserWithEmailAndPassword(fb.a, String(email).trim(), senha);
    try { if (c.user && c.user.updateProfile) await c.user.updateProfile({ displayName: String(email).split('@')[0] }); } catch (e) {}
    return c.user;
  }
  async function sair() {
    if (!fb) return;
    await fb.auth.signOut(fb.a);
    L.pronto = false; L.quem = '';
    try { real.removeItem('eclipse_conta_v1'); } catch (e) {}
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

  /* Sobe o que ESTA máquina tem AGORA para o banco, uma vez. É o "passar as fichas pro
     Firebase" que ele pediu. Existe separada do flush porque aqui a ordem é a contrária
     (o local manda, o banco aceita) e só quem é dono da mesa aperta este botão. */
  async function subirTudo(forcar) {
    if (!fb || !L.pronto) throw new Error('entre no Firebase antes de subir a mesa');
    const relatorio = [];
    const chaves = [];
    for (let i = 0; i < LS.length; i++) { const k = real.key(i); if (ehDaMesa(k)) chaves.push(k); }
    for (let i = 0; i < chaves.length; i++) {
      const chave = chaves[i];
      const texto = real.getItem(chave);
      if (texto === null) continue;
      let valor = texto;
      if (TRUNCAR[chave]) {
        try { const arr = JSON.parse(texto); if (Array.isArray(arr) && arr.length > TRUNCAR[chave]) valor = JSON.stringify(arr.slice(0, TRUNCAR[chave])); } catch (e) {}
      }
      if (!forcar && tsVisto[chave]) { relatorio.push({ chave: chave, foi: false, nota: 'já veio da nuvem' }); continue; }
      try {
        const corpo = { ts: Date.now(), por: L.uid || L.quem };
        if (chave.indexOf('_portrait') !== -1 || valor.length > MAX_DOC) {
          const r = fb.st.ref(fb.s, caminhoDaChave(chave));
          await fb.st.uploadString(r, valor, 'raw', { contentType: 'application/json' });
          corpo.__storage = caminhoDaChave(chave); corpo.len = valor.length;
        } else corpo.valor = valor;
        await fb.fs.setDoc(docRef(chave), corpo);
        tsVisto[chave] = corpo.ts;
        relatorio.push({ chave: chave, foi: true, bytes: valor.length, nota: corpo.__storage ? 'imagem no Storage' : '' });
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
    const o = { mesa: (CFG && CFG.mesa) || '-', ts: Date.now(), por: L.quem || 'sem-conta', chaves: {} };
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
        modo: (!CFG || !CFG.ativo) ? 'local' : (L.pronto ? 'nuvem' : (L.nuvem ? 'sem-conta' : 'local')),
        online: global.navigator ? global.navigator.onLine !== false : true,
        quem: L.quem, erro: L.erro, pendentes: pendentes(),
        mesa: (CFG && CFG.mesa) || '-', conflito: L.conflito, naVem: L.naVem, snapshot: L.snapshot
      };
    },
    entrar: entrar, criar: criar, sair: sair, flush: flush, subirTudo: subirTudo, dump: dump,
    onStatus: function (f) { if (typeof f === 'function') { ouvintes.push(f); try { f(API.status()); } catch (e) {} } },
    daMesa: ehDaMesa,
    ligar: ligar
  };

  global.ECLIPSE_STORE = API;
  global.__STORE_OK = true;

  if (global.addEventListener) {
    global.addEventListener('online', function () { flush(); avisar(); });
    global.addEventListener('offline', function () { avisar(); });
  }
  faxinaFila();
  ligar();
})(window);
