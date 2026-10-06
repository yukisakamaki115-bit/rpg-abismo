/* ===== Ficha 4 — identidade =====
   Este arquivo só descreve quem ela é; a mecânica inteira está em js/ficha-comum.js
   (carregado depois deste). Nada aqui inventa poder: amanhã, quando o mestre definir a
   magia dela, se acrescenta um bloco próprio — os números abaixo são os provisórios.

   QUEM ELA É (dado pelo mestre em 28/09): o amor da Flora. A alma dela foi levada para o
   Crepúsculo. Ela é uma luz em cima de toda aquela escuridão — e ao mesmo tempo carrega a
   escuridão de estar lá dentro. A história continua amanhã, então os textos da página são
   editáveis e não fecharam nada que o mestre ainda não decidiu.

   06/10 — O mestre deu o nome definitivo: TESSALHA. Ela atendeu por "Vesper" (véspera = o
   momento exato entre a luz e a escuridão) desde 28/09, e era nome de trabalho mesmo — agora não
   é mais. O que ficou com o nome velho de propósito:
   - `id`, `chave` (eclipse_ficha4_v1) e `identidade` (vesper-v1): são a matrícula do armazenamento.
     Trocá-los faria o motor achar que chegou outra personagem e recomeçaria a ficha limpa, apagando
     o que ela já tem de armas, marca e texto.
   - as rolagens antigas do histórico: continuam assinadas "Vesper", porque o que já foi rolado na
     mesa não se reescreve. É por isso que o painel do mestre tem alias no feed dela.
   - O nome que aparece no topo da ficha é editável (data-txt="nome") e não mexe no histórico.
   - O que aparece em cada rolagem nova é CONF.quem, fixo de propósito: trocar o rótulo na tela
     não renomeia as rolagens antigas do grupo (e o painel do mestre continua achando ela).

   01/10 — O mestre definiu: ela não é UMA personagem, são TRÊS na mesma pessoa. Uma troca de
   personalidade a qualquer momento, e cada personalidade é uma ficha própria — só Brasa e
   Vínculo continuam os mesmos (é o MESMO corpo); efeitos e poder são de cada uma. A primeira
   que ele escreveu foi a Tessalha; as outras duas ele vai ditar depois. Por isso a mecânica
   toda mora em js/vesper.js e o que está aqui embaixo é só a descrição: personalidade nova é
   uma linha nesta lista + o poder dela no bloco, nada é reescrito.

   02/10 — Chegou a segunda: Trinstan, "a razão entre os 3". O poder dele é uma Orbe que ele
   arremessa no inimigo, e o dano dela vem da VELOCIDADE com que ela chega (estilo o Q da Zoe:
   orbe rápida dói mais). Ele escolheu assim: a velocidade é sorteada (d10), não é atributo —
   então nenhum número novo entra nos 5 canônicos — e quem baixa a vida do inimigo continua
   sendo o mestre na aba de inimigos (a Orbe nunca escreve na ficha de ninguém nem no bestiário).
   Os números do poder estão em CONF.trinstan logo abaixo da lista.

   Ainda no 02/10 — ele cobrou o que faltava no esquema: "cada personalidade é uma ficha nova"
   NÃO valia só pro poder e pra cor. Os STATUS também trocam: quem está no corpo é quem define
   os cinco números. A Tessalha usa o conjunto que já estava aqui (o de baixo, em CONF.attrs) e
   o Trinstan declarou o dele. Brasa e Vínculo continuam os mesmos — é o MESMO corpo; e o que o
   mestre editar no painel fica guardado por personalidade (state.persAttrs), senão trocar de
   humor apagaria a edição dele.

   06/10 — Fechou a tríade: chegou o terceiro, THALLES, o arco de luz. Os números dele estão em
   CONF.thalles. É o primeiro poder do grupo que não tira só vida atual: a flecha fere a alma e
   come um pedaço da VIDA MÁXIMA do alvo, para sempre, até o mestre devolver. Por isso ele é o
   único com três travas (cargas máximas, teto de alma por inimigo e piso de 1 de vida máxima) e
   por isso também quem baixa o teto continua sendo o MESTRE: a ficha escreve a conta na tela e
   no histórico, e não toca no bestiário. A história dos três ele manda depois. */
window.FICHA_CONF = {
  chave: 'eclipse_ficha4_v1',
  quem: 'Tessalha', // 06/10: era 'Vesper' — o nome novo assina as rolagens novas, as velhas ficam no alias do mestre
  identidade: 'vesper-v1', // matrícula da personagem: trocou quem é, o motor recomeça a ficha (e espelha o estado antigo)
  /* O nome dela também mora em texto que FOI salvo no navegador de quem joga (o título editável e
     a lista "Contas abertas", que pedia o nome definitivo). `CONF.migrar` é o gancho do motor para
     esses casos: roda uma vez, logo depois do load, e só escreve de volta se mudou alguma coisa. */
  migrar: function (s) {
    var mudou = false;
    var soLetra = function (t) { return String(t).replace(/<[^>]*>/g, ' ').trim().toLowerCase(); };
    if (typeof s.nome === 'string' && soLetra(s.nome) === 'vesper') { s.nome = 'Tessalha'; mudou = true; }
    if (s.textos && typeof s.textos.nome === 'string' && soLetra(s.textos.nome) === 'vesper') { s.textos.nome = 'Tessalha'; mudou = true; }
    if (s.textos && typeof s.textos.abertas === 'string' && s.textos.abertas.indexOf('Nome definitivo') !== -1) {
      s.textos.abertas = s.textos.abertas.replace(/☐\s*Nome definitivo[^<]*/,
        '✔ 06/10 — Nome definitivo dela: <b>Tessalha</b> (até aqui era "Vesper", nome de trabalho).');
      mudou = true;
    }
    return mudou;
  },
  hp: { nome: 'Brasa', max: 26 },      // a luz que ela carrega (vida) — é DELA, não de cada personalidade
  san: { nome: 'Vínculo', max: 100 },  // o que ainda a amarra aqui fora (sanidade) — idem
  /* Os cinco CANÔNICOS (mesmas chaves nas 5 fichas — o motor e os cards do mestre dependem
     disso). Este conjunto é o corpo sem ninguém no comando, e é também o da Tessalha: uma
     personalidade que não declare `attrs` próprios usa estes números aqui. Quem declara, troca
     os cinco ao assumir o corpo — é a "ficha nova dentro da ficha" que o mestre pediu. */
  attrs: { forca: 9, destreza: 13, constituicao: 10, inteligencia: 12, carisma: 16 },
  eff: { morta: '☠️ Apagada', incap: '🟡 Vacilando' },

  /* As três que ela é. `vaga: true` é lugar reservado de propósito: o botão já aparece na
     tela, mas não liga nada — o mestre ainda não escreveu o que aquela personalidade faz.
     Ordem aqui é a ordem dos botões. Trocar "Tessalha" de nome depois é só o `nome`/`emoji`:
     o `id` é o que fica salvo no estado dela (e é ele que pinta a cor da ficha: o CSS da
     personalidade é `body[data-pers="tessalha"]`). */
  personalidades: [
    {
      id: 'tessalha', nome: 'Tessalha', emoji: '🌿',
      oQueE: 'a aura verde que chega junto de quem ela escolher',
      oQueFaz: 'recebe, sem fazer nada, o bem que cai na pessoa escolhida: toda cura e todo buff que aquela pessoa ganha caem também nela.',
      oQueCusta: 'nada. O limite é a atenção: ela escuta UMA pessoa por vez, e a aura só cabe dois empréstimos de cada vez.'
    },
    {
      id: 'trinstan', nome: 'Trinstan', emoji: '🌀',
      oQueE: 'a razão dele — a parte que conta em vez de sentir',
      oQueFaz: 'controla uma Orbe e a arremessa em quem ele escolher. O que dói é a velocidade: ela sai num d10, e o dano é o dobro dela. Orbe devagar quase não arranha; orbe no teto esmaga.',
      oQueCusta: '1 de Vínculo por arremesso — 2 quando a Orbe passa direto e não bate em nada. É a razão dele que paga a conta de cada lançamento.',
      /* Os números dele: a razão não sustenta o mesmo corpo que a aura. Ele não bate (Força 8),
         mas a mão que solta a Orbe na hora certa é a melhor do grupo (Destreza 15) e ele conta
         tudo (Inteligência 18) em vez de chegar nas pessoas (Carisma 10). Mesmo total da
         Tessalha (60): o que muda é a distribuição, senão trocar de personalidade seria subir de
         nível disfarçado. Estes números valem nas rolagens de Status — a Orbe não usa nenhum. */
      attrs: { forca: 8, destreza: 15, constituicao: 9, inteligencia: 18, carisma: 10 }
    },
    /* Thalles, o terceiro dos três (06/10): o arco de luz que fere alma. A história dele ele
       manda depois — o que está escrito aqui é a MECÂNICA que ele pediu, e os números moram em
       CONF.thalles logo abaixo. É o único poder do grupo que mexe no TETO de um inimigo, então é
       também o único com teto próprio (`almaMax`) e com a trava de nunca deixar a vida máxima
       do bicho cair pra menos de 1. */
    {
      id: 'thalles', nome: 'Thalles', emoji: '🏹',
      oQueE: 'a luz dele — a parte que ataca de longe e não perdoa',
      oQueFaz: 'conjura um Arco de Luz e o carrega até três cargas. A flecha que sai fere a ALMA do alvo: além do dano de sempre, o inimigo perde um pedaço da própria vida máxima — e vida máxima perdida não volta sozinha.',
      oQueCusta: '1 de Vínculo por carga e 1 por disparo — e 2 quando a flecha se desfaz no ar depois de o arco já estar pago. Ferir a alma cobra mais caro do que só bater.',
      /* Os números dele: é o arqueiro dos três. Destreza 17 é a mão que puxa a corda, Força 12 é
         o braço que segura o arco conjurado, e os outros três caem porque ele é só ataque. Mesmo
         total das outras duas (60) — trocar de personalidade continua não ser subir de nível. */
      attrs: { forca: 12, destreza: 17, constituicao: 11, inteligencia: 10, carisma: 10 }
    }
  ],

  /* A Orbe em números. O multiplicador é o que liga "velocidade" a "dano": com ×2, um d10
     vira 2–20 de dano, e o mestre continua dono da vida dos inimigos dele — se a mesa achar
     pouco/muito, é UMA linha aqui (e o texto impresso na ficha é lido destes números, então
     eles nunca divergem do que a página promete). `passaAte` é a faixa de erro: velocidade
     baixa é orbe que chegou tarde demais e atravessou o alvo. */
  trinstan: {
    marca: '🌀',
    dado: 10,        // a velocidade sorteada
    mult: 2,         // dano = velocidade × isto
    passaAte: 2,     // velocidade até aqui = a Orbe passou direto (0 de dano)
    custo: 1,        // Vínculo por arremesso
    custoErro: 2     // Vínculo quando erra: a frustração cobra o dobro
  },

  /* O Arco de Luz em números. Três coisas precisaram de teto, e é bom estar escrito aqui em vez
     de escondido no código: (1) `cargasMax` — sem ele o arco ficaria carregado pra sempre e
     viraria bala sem limite; (2) `almaMax` — "tirar vida máxima" é o poder mais forte do site
     porque é permanente: sem teto por inimigo, três flechas apagam um chefe do mapa; (3) o
     disparo nunca derruba a vida máxima pra menos de 1 — a alma some, o bicho não vira pó.
     O dano dele é o ÚNICO do grupo que não depende do dado (a mira só decide se a flecha chega),
     e isso é de propósito: carregar é decisão, orbe é aposta — os dois estilos de ataque dele. */
  thalles: {
    marca: '🏹',
    cargasMax: 3,      // quantas cargas o arco aguenta
    custoCarga: 1,     // Vínculo por carga
    custoTiro: 1,      // Vínculo por flecha solta
    custoErro: 2,      // Vínculo quando a flecha se desfaz no ar (as cargas já foram pagas)
    dado: 10,          // a mira sorteada
    erraAte: 2,        // mira até aqui = a flecha se desfaz antes de tocar a alma (0 de tudo)
    critEm: 10,        // natural 10 = pegou em cheio: a mordida na alma dobra
    danoPorCarga: 4,   // vida ATUAL do alvo: cargas × isto
    almaPorCarga: 1,   // vida MÁXIMA que o alvo perde: cargas × isto (×2 no cheio)
    almaMax: 6         // teto de vida máxima que UM mesmo inimigo pode perder
  },

  /* A Tessalha em números. Os tetos são as únicas travas que ela tem — sem eles, uma mesa
     que cura muito transformaria a Vesper na personagem mais forte do grupo por acidente.
     `alvos` são as fichas do grupo (a dela fica de fora: eco de si mesma não é poder, é
     desperdício). As chaves têm que bater com o js de cada ficha, ou ela escuta o nada. */
  tessalha: {
    marca: '🌿',
    ecoMax: 2,                       // quantos buffs emprestados a aura carrega ao mesmo tempo
    alvos: [
      { chave: 'eclipse_flora_v1', nome: 'Flora', emoji: '🌹' },
      { chave: 'eclipse_coelho_v1', nome: 'Nox', emoji: '🐰' },
      { chave: 'eclipse_santiago_v1', nome: 'Dante', emoji: '🔮' },
      { chave: 'eclipse_ficha5_v1', nome: 'Clara', emoji: '🏮' }
    ]
  }
};
