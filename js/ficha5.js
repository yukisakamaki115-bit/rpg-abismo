/* ===== Ficha 5 — Clara Masorack, a coletora de almas perdidas =====
   Antes este arquivo era uma casca vazia (o mestre ainda não tinha ideia da personagem).
   Na v1.31 ele trouxe a história dela, e o que está escrito aqui é a história dele —
   traduzida em números, não inventada por cima.

   O que ele deu e virou regra (e o que ele NÃO deu, que ficou ☐):
   - vive entre as sobras do crepúsculo, e nas noites do mundo real perambula com o
     lampião de brilho vermelho coletando as almas que foram perdidas  →  🕯️ Almas;
   - "o conhecimento é o poder", e o conhecimento virou poder numa das andanças dela
     pelas florestas  →  Inteligência é o atributo-chave dela: é ela que faz a Clara enxergar
     alma perdida (o teste de d10 + Int ≥ 11). Nas invocações a Int NÃO soma dano: o que sai
     é a linha da tabela, senão o teto declarado do poder ia embora com o buff da cabeça;
   - capuz vermelho + lampião encontrados numa casa abandonada na floresta; o lampião
     chamava o nome dela e ela não consegue se soltar dele  →  o vínculo é mecânica
     (🚫 longe dele ela perde −2 em tudo), não só enfeite;
   - invoca fogo e criaturas antigas "com aleatoriedade"  →  duas tabelas de d10
     impressas na ficha, cada linha declarando o que sai;
   - "elas não têm poderes fora do mundo do crepúsculo"  →  as invocações SÓ funcionam
     lá dentro. No mundo real o lampião alumbra e mostra almas, e é isso;
   - chave mágica que abre portal em qualquer porta  →  🗝️ atravessar é sempre possível
     e não custa nada: o preço é o que tem do outro lado (decisão do mestre);
   - arco curto "só para quando precisa"  →  arma inicial do inventário (d6, sem magia);
   - 17 anos, perdeu os pais, de orfanato em orfanato, trabalha numa cafeteria de manhã
     →  texto de perfil (editável, como tudo nela);
   - ☐ o que ela faz lá dentro do crepúsculo ainda não se sabe: NÃO foi inventado. A aba
     Lampião tem o bloco aberto e o painel do mestre mostra ela atravessando.

   Atributos: desde 06/10 a mesa tem UMA regra de criação — base 1, até 4 pontos no mesmo
   atributo, 10 pontos para distribuir (js/atributos.js). Esta ficha abre com os cinco em 1 e a
   jogadora preenche. Ela é magra, nova e não bate forte: os 10 pontos dela pedem Inteligência e
   Destreza, porque é a cabeça que acha alma e a mão que segura o arco — e porque metade do kit
   dela só funciona do outro lado da porta. */
window.FICHA_CONF = {
  chave: 'eclipse_ficha5_v1',
  quem: 'Clara', // fixo nas rolagens e no feed; o nome bonito ela edita no título
  identidade: 'clara-v1', // era casca vazia; esta string diz ao motor que o estado velho não é dela
  retrato: 'img/clara.png', // a arte que o mestre mandou; some se ela tirar o retrato
  hp: { nome: 'Vida', max: 20 },
  san: { nome: 'Sanidade', max: 100 },
  attrs: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, carisma: 1 },
  eff: { morta: '☠️ Morta', incap: '🟡 Incapacitada' },
  armasIniciais: [{ nome: 'Arco curto', dano: 'd6' }],

  /* O lampião — a habilidade dela inteira em números. Cada valor em uma linha, pra ele
     poder ajustar sem caçar nada: o motor (js/ficha-comum.js) só sabe existir; quem
     conhece o poder é este arquivo e o js/lampiao.js, que desenha a cara.
     O ciclo, em uma linha:
       procurar alma (Mundo Real, d10+Int ≥ 11) → guarda no vidro (máx 6) →
       atravessa de graça pela chave → gasta alma e rola 1d10 numa das duas tabelas →
       o dano é o da linha (0 a 9); o 1 machuca a cabeça dela.
     Fora do crepúsculo ela NÃO invoca nada. Longe do lampião: -2 em tudo (gancho, não ficha). */
  lampiao: {
    almasMax: 6,        // cabe no vidro do lampião. Mais que isso transborda e se perde.
    alma: {
      attr: 'inteligencia',
      alvo: 11,         // d10 + Inteligência ≥ 11 → 1 🕯️. Com Int 5 (o teto da mesa) ela precisa de 6+ no
                        // dado, ~metade das vezes — a mesma chance de antes. Com Int 1 seria só no 10
                        // natural: por isso a cabeça é o primeiro lugar onde ela deve gastar os 10 pontos.
      marca: '🕯️'
    },
    longe: {
      penalidade: -2,   // sem o lampião por perto ela não pensa direito (o vínculo é dele, não dela)
      marca: '🚫'
    },
    invocar: {
      /* 🔥 Fogo — 1 🕯️. Média da tabela: 4,5 de dano, com risco de −5 de sanidade no 1. */
      fogo: {
        nome: '🔥 Fogo', custo: 1,
        tabela: [
          { r: 'o lampião chama outra coisa primeiro — ela ouve o passo dela antes de ver', dano: 0, san: -5,
            cena: 'o que dá o passo não está escrito em lugar nenhum: é o mestre quem decide agora' },
          { r: 'só fumaça vermelha. Nada queima.', dano: 0 },
          { r: 'só fumaça — mas ela mostra por onde a fumaça escorre', dano: 0 },
          { r: 'uma língua de fogo atravessa o ar', dano: 5 },
          { r: 'uma língua de fogo atravessa o ar', dano: 5 },
          { r: 'o pavio pega de vez', dano: 6 },
          { r: 'o pavio pega de vez', dano: 6 },
          { r: 'fogo de lampião velho, que já queimou guerra', dano: 7 },
          { r: 'fogo de lampião velho, que já queimou guerra', dano: 7 },
          { r: 'o clarão puxa uma alma no caminho de volta', dano: 9, almas: 1 }
        ]
      },
      /* 🐙 Criatura Antiga — 2 🕯️. Média: 5,7 de dano, e o 1 cobra 10 de sanidade dela. */
      voz: {
        nome: '🐙 Criatura Antiga', custo: 2,
        tabela: [
          { r: 'não é a criatura que responde — é o lampião que puxa ela pra perto', dano: 0, san: -10,
            cena: 'o que o lampião queria mostrar pra ela é o mestre quem decide agora' },
          { r: 'um vulto obedece, mas cobra o olhar dela', dano: 3, san: -3 },
          { r: 'asas de pano varrem o chão', dano: 4 },
          { r: 'asas de pano varrem o chão', dano: 4 },
          { r: 'muitas pernas, nenhuma pressa', dano: 6 },
          { r: 'muitas pernas, nenhuma pressa', dano: 6 },
          { r: 'o bicho que já existia antes da floresta ter nome', dano: 8 },
          { r: 'o bicho que já existia antes da floresta ter nome', dano: 8 },
          { r: 'vem o que o lampião chamou na primeira guerra dele', dano: 9 },
          { r: 'vem, obedece — e faz uma pergunta que ela vai ter que responder', dano: 9, marca: '🗣️ Cobrança antiga',
            cena: 'a pergunta é do mestre, dita em voz alta na mesa; a resposta dela fica valendo' },
        ]
      }
    }
  }
};
