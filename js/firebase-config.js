/* ===== Éclipse — configuração do Firebase da mesa =====
   Dado que o mestre entregou em 06/10 (console → Configurações do app → SDK do Firebase).

   SOBRE A apiKey: ela NÃO é segredo. Toda web app do Firebase publica a dela no próprio
   bundle. Quem protege os dados são as regras (`firestore.rules` / `storage.rules`, que estão
   na raiz do projeto e precisam ser coladas no console). Trocar este arquivo não abre nem
   fecha a mesa — quem fechar a porta é a regra.

   `mesa` é o id da SALA dentro do projeto. Tudo da mesa mora em
   `mesas/{mesa}/chaves/{chave}` — onde `chave` é exatamente o nome que já era usado no
   localStorage (`eclipse_ficha4_v1`, `eclipse_inimigos_v1`, …). Se um dia ele quiser uma
   segunda mesa no mesmo projeto, é uma linha aqui, e nada no código muda.

   Para desligar a nuvem e voltar ao modo 100% local sem apagar nada: `ativo: false`.
   O js/store.js lê essa flag e vira um passes-through do localStorage. */
window.FIREBASE_CFG = {
  ativo: true,
  mesa: 'mesa-1',
  sdk: '12.0.0', // versão do SDK modular servido pelo CDN do Google (gstatic)
  apiKey: 'AIzaSyBbSq_M2arjAl45r6S1f_CUD_KeE7JV1_I',
  authDomain: 'ok-banco-de-da.firebaseapp.com',
  projectId: 'ok-banco-de-da',
  storageBucket: 'ok-banco-de-da.firebasestorage.app',
  messagingSenderId: '25473198859',
  appId: '1:25473198859:web:56e2977513680d6d56100e',
  measurementId: 'G-JXY186ZLHV' // analytics NÃO é carregado de propósito: ele quebra em file:// e ninguém pediu métrica
};
