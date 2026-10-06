/* ===== Éclipse — configuração do Firebase da mesa =====
   Dado que o mestre entregou em 06/10 (console → Configurações do app → SDK do Firebase).

   SOBRE A apiKey: ela NÃO é segredo. Toda web app do Firebase publica a dela no próprio
   bundle. Quem protege os dados são as REGRAS (`database.rules.json`, que está na raiz do
   projeto e precisa ser colada em console → Realtime Database → Regras). Trocar este arquivo
   não abre nem fecha a mesa — quem fecha a porta é a regra.

   ─── O QUE MUDOU NA v1.37: o banco é o REALTIME DATABASE, não o Firestore ───
   O projeto `ok-banco-de-da` tem o Realtime Database criado (`ok-banco-de-da-default-rtdb`,
   em us-central1). O Firestore nunca foi habilitado nele — a API responde 403 "has not been
   used in project". A versão anterior apontava para o Firestore, então nenhuma ficha
   atravessava e a tela do mestre ficava parada. `databaseURL` é a linha que diz ONDE fica o
   banco: ela NÃO vem no bloco que o console copia quando o banco ainda não existia, por isso
   está escrita aqui à mão. É o endereço que aparece no topo da tela do Realtime Database.

   `mesa` é o id da SALA dentro do projeto. Tudo da mesa mora em
   `mesas/{mesa}/chaves/{chave}` — onde `chave` é exatamente o nome que já era usado no
   localStorage (`eclipse_ficha4_v1`, `eclipse_inimigos_v1`, …) — e as fotos de retrato em
   `mesas/{mesa}/retratos/{chave}`. Se um dia ele quiser uma segunda mesa no mesmo projeto, é
   uma linha aqui, e nada no código muda.

   Para desligar a nuvem e voltar ao modo 100% local sem apagar nada: `ativo: false`.
   O js/store.js lê essa flag e vira um passes-through do localStorage. */
window.FIREBASE_CFG = {
  ativo: true,
  mesa: 'mesa-1',
  sdk: '12.0.0', // versão do SDK modular servido pelo CDN do Google (gstatic)
  databaseURL: 'https://ok-banco-de-da-default-rtdb.firebaseio.com',
  apiKey: 'AIzaSyBbSq_M2arjAl45r6S1f_CUD_KeE7JV1_I',
  authDomain: 'ok-banco-de-da.firebaseapp.com',
  projectId: 'ok-banco-de-da',
  storageBucket: 'ok-banco-de-da.firebasestorage.app',
  messagingSenderId: '25473198859',
  appId: '1:25473198859:web:56e2977513680d6d56100e',
  measurementId: 'G-JXY186ZLHV' // analytics NÃO é carregado de propósito: ele quebra em file:// e ninguém pediu métrica
};
