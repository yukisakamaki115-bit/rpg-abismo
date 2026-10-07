/* ===== Ficha 6 — o ágil da mesa (o jogador dele pediu a pessoa, os números são nossos) =====
   Esta ficha não existia até 06/10. O que ela é vem de UMA frase dele, dita na pergunta que eu
   fiz depois de ele responder "Eu já sei quem é — me pergunta":

     "mais ágil e leve, focado em velocidade, esquiva e mobilidade… não quero o cara forte que
      fica batendo de frente… força mediana… principais atributos são agilidade/destreza,
      reflexos e talvez percepção… despreocupado ou estiloso, mas difícil de acertar…
      avanço/dano… vida de militar, treinou nas missões e desenvolveu excelente vantagem com
      armas de fogo… assassino/atirador, pique Hitman… a arma dele é tipo a foice do Noob Saibot…
      o poder dele permite aumentar atributos em +2 ou mais sacrificando sanidade, máximo de +4
      em tudo e mínimo de −8 de sanidade por uso de buff… buff no corpo, alimentando status"

   Traduzido, sem inventar por cima:
   - agilidade / reflexos / mira  →  a mesa NÃO tem atributo "Agilidade" nem "Percepção": são os
     mesmos cinco de sempre (a regra é canônica nas 6 fichas). Destreza é onde mora velocidade,
     reflexo e mira; Inteligência é onde mora percepção. Isso está escrito na ficha para ele, em
     português claro, e não é segredo de regras.
   - "difícil de acertar"  →  💨 Esquiva: ele rola e o total vira a barra que o ataque do mestre
     precisa passar. O número publicado aparece no card dele no painel do mestre, senão o mestre
     teria que anotar em papel.
   - "excelente vantagem com armas de fogo"  →  🎯 a pistola rola com VANTAGEM: dois lançamentos
     de dano, fica o melhor. É o que a palavra "vantagem" pede, e não precisa inventar tabela.
     Por isso a base dela é modesta (d6+1): quem sempre escolhe o melhor dos dois dados já leva
     ~+2 de média por tiro, sem nenhum bônus escrito.
   - "a foice do Noob Saibot"  →  ⚔ Foice, d8. Não d10: com a regra nova o atributo soma até +5 e
     a vantagem ainda não está liberada na foice, então d10 faria dela a arma mais pesada da mesa
     nas mãos de quem declarou ser o "leve". O mestre ajusta no painel — arma é editável.
   - "aumentar atributos pagando sanidade"  →  💨 IMPULSO, a mecânica dele, em js/impulso.js.
     Cada dose é +2 num atributo e cobra 8 de Sanidade na hora (o "mínimo de −8 por uso").
     Teto de +4 por atributo E +4 somado na conta toda (o "máximo de +4 em tudo"): ou dois
     atributos em +2, ou um em +4. Soltar o impulso devolve os pontos, NUNCA a Sanidade gasta.
     O bônus NÃO entra no número do atributo: ele mora no gancho por atributo do motor, porque
     se entrasse no atributo estaria "gastando" os 10 pontos da criação.
   - "buff no corpo, alimentando status"  →  o impulso vale também no dano das armas ligadas ao
     atributo aumentado (foice e pistola somam Destreza). É a única forma de "alimentar status"
     ter efeito numa mesa onde dano e atributo eram contas separadas.

   Atributos: base 1, até 4 pontos por atributo, 10 para distribuir (js/atributos.js). Os 10 dele
   pedem Destreza primeiro (é a mão dele: velocidade, reflexo, mira, e o dano das duas armas),
   depois Constituição ou Inteligência. Nada aqui é pré-gasto — a ficha abre com os cinco em 1 e
   é ele quem distribui, como em todas.

   ☐ O que NÃO foi inventado e fica com o mestre: o que acontece com a Sanidade gasta (ela
   volta? quando?), o que ele vê quando a Sanidade chega em 0, e de onde ele veio no mundo
   (a frase dele disse "militar", não disse qual exército nem em que guerra). */
window.FICHA_CONF = {
  chave: 'eclipse_ficha6_v1',
  quem: 'Kael', // fixo nas rolagens e no feed; o nome completo ele edita no título da ficha
  identidade: 'kael-v1', // matrícula: muda esta string e a ficha nasce limpa de propósito
  /* Ele não tem arte. Sem `retrato` o círculo abre com o convite de subir uma imagem, e o
     painel do mestre usa a inicial — é o mesmo caminho da Clara antes da arte dela chegar. */
  hp: { nome: 'Vida', max: 22 },
  san: { nome: 'Sanidade', max: 100 }, // 100 porque é com ela que ele paga o próprio poder
  attrs: { forca: 1, destreza: 1, constituicao: 1, inteligencia: 1, carisma: 1 },
  eff: { morta: '☠️ Morto', incap: '🟡 No chão' },

  /* As duas armas dele, já com a ligação de atributo e a vantagem do treino militar.
     `attr` é lido pelo motor (js/ficha-comum.js) e `armaPorNome` abaixo é a reserva: se o
     mestre mandar a mesma arma pelo catálogo, os campos extras se perdem no caminho, e a
     reserva devolve a ligação pelo nome. */
  armasIniciais: [
    { nome: 'Foice', dano: 'd8', attr: 'destreza' },
    { nome: 'Pistola', dano: 'd6+1', attr: 'destreza', adv: true }
  ],
  armaPorNome: {
    'foice': { attr: 'destreza' },
    'foice curta': { attr: 'destreza' },
    'pistola': { attr: 'destreza', adv: true },
    'pistola leve': { attr: 'destreza', adv: true }
  },

  /* 💨 O impulso, em números — tudo que js/impulso.js precisa saber. Uma linha por valor,
     para o mestre ajustar sem caçar nada dentro do bloco.
     O ciclo, em uma linha:
       escolhe o atributo → paga 8 de Sanidade na hora → recebe +2 nele (até 4 no atributo
       e 4 na conta toda) → ajeita o corpo → solta quando quiser (os pontos voltam, a
       Sanidade não). */
  impulso: {
    passo: 2,        // cada dose vale +2 no atributo escolhido
    custo: 8,        // Sanidade cobrada por dose — o "mínimo de −8 de sanidade por uso"
    tetoAttr: 4,     // até +4 no mesmo atributo
    tetoTotal: 4,    // e +4 somando tudo: é o "máximo de +4 em tudo" que ele pediu
    marca: '💨',
    /* O atributo preferido dele aparece primeiro e vem marcado na tela: é Destreza, porque é
       onde mora a velocidade, o reflexo, a mira E o dano das duas armas. Os outros quatro
       recebem dose igualmente — ele pediu "aumentar atributos", no plural. */
    foco: 'destreza',
    esquiva: { attr: 'destreza', marca: '🌀' } // rolar → o total vira a barra do ataque
  }
};
