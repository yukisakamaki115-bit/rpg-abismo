/* ===== Éclipse — js/retrato.js: a MESMA moldura do retrato em toda tela =====
   Por que ele existe: o editor de retrato (js/ficha-comum.js) não guarda só a foto, guarda o
   enquadramento — `{src, zoom, panX, panY}`, com o arrasto em fração do diâmetro. Cada tela que
   mostra o retrato por conta própria resolvia do seu jeito, e o resultado apareceu na tela do
   mestre: `object-fit:cover` puro mostra o MEIO da foto original e ignora o que a pessoa
   emoldurou. Foto de personagem desenhada em pé = no disco do mestre sai cortada no pescoço,
   "fora do quadro", exatamente como ele relatou em 06/10.

   Este arquivo é a conta UMA vez só, e quem mostra retrato usa: o painel do mestre (6 cards) e
   o salão (6 cards — o 6º ainda não tem arte, e por isso nele cai o disco com a inicial).
   A própria ficha não precisa — ela já tem o `framing()` dela, que é dono do
   editor. Se um dia o editor mudar a matemática, muda aqui junto: as duas precisam concordar.

   Nada aqui depende de rede, de config ou de outro arquivo. Sem `ECLIPSE_RETRATO`, as telas
   continuam funcionando do jeito velho (emoji ou cover), nunca quebram por causa disto. */
(function (global) {
  'use strict';

  var MAX_ZOOM = 3; // bate com o slider do editor (`max="3"` no #cropZoom)

  function num(v, padrao) { var n = Number(v); return isFinite(n) ? n : padrao; }
  function segura(src) {
    /* Só imagem de verdade vira atributo src. O retrato atravessa a mesa vindo de OUTRA
       máquina, então um `javascript:` no lugar da data-url é vetor de ataque, não detalhe. */
    return typeof src === 'string' && /^(data:image\/|https?:\/\/)/i.test(src);
  }

  /* Aceita as três formas que já existiram na chave `<chave>_portrait`: o JSON do editor, a
     data-url solta (resíduo de versão antiga) e o `{removido:true}` de quem tirou o retrato. */
  function ler(bruto) {
    if (!bruto) return null;
    if (segura(bruto)) return { src: bruto, zoom: 1, panX: 0, panY: 0 };
    var d = null;
    try { d = (typeof bruto === 'string') ? JSON.parse(bruto) : bruto; } catch (e) { return null; }
    if (!d || typeof d !== 'object' || d.removido || d.stub) return null;
    if (!segura(d.src)) return null;
    return {
      src: d.src,
      zoom: Math.max(1, Math.min(MAX_ZOOM, num(d.zoom, 1))),
      panX: Math.max(-1, Math.min(1, num(d.panX, 0))),
      panY: Math.max(-1, Math.min(1, num(d.panY, 0)))
    };
  }

  /* A moldura em si: cobrir o disco, aplicar o zoom de quem emoldurou e o arrasto em fração do
     diâmetro. O `box` é lido do próprio elemento, então o mesmo retrato sai igual em 62px no
     painel do mestre e em 92px no salão. */
  function moldar(img, caixa, dado) {
    if (!img || !caixa || !dado) return;
    var box = caixa.clientWidth || caixa.offsetWidth || 0;
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!box || !w || !h) return; // com medida zero (aba escondida) não se desenha: o onload chama de novo
    var s = Math.max(box / w, box / h) * (dado.zoom || 1);
    img.style.position = 'absolute';
    /* `inset:auto` desfaz o `inset:0` que o CSS do salão põe no <img>: com left, right E width
       definidos ao mesmo tempo, o navegador ignora o right e a conta da moldura sai torta. */
    img.style.inset = 'auto';
    img.style.width = Math.round(w * s) + 'px';
    img.style.height = Math.round(h * s) + 'px';
    img.style.left = Math.round((box - w * s) / 2 + (dado.panX || 0) * box) + 'px';
    img.style.top = Math.round((box - h * s) / 2 + (dado.panY || 0) * box) + 'px';
  }

  /* O jeito fácil para quem só quer "põe o retrato neste disco, senão põe o emoji":
     - `caixa`   : elemento quadrado, com `position:relative` e `overflow:hidden` no CSS
     - `bruto`   : o string cru de localStorage (`<chave>_portrait`), ou null
     - `padrao`  : arte de estreia da personagem (URL), usada quando não há retrato salvo
     - `fallback`: o que escrever na caixa quando não há imagem nenhuma (o emoji)
     Devolve true se pintou imagem. */
  function pintar(caixa, bruto, padrao, fallback) {
    if (!caixa) return false;
    var dado = ler(bruto);
    var src = dado ? dado.src : (segura(padrao) ? padrao : '');
    var img = caixa.querySelector('img');
    if (!src) {
      if (img && img.parentNode) img.parentNode.removeChild(img);
      if (caixa.textContent !== fallback) caixa.textContent = fallback == null ? '' : String(fallback);
      caixa.classList.remove('tem-retrato');
      return false;
    }
    if (caixa.firstChild !== img) {
      while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
      img = global.document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      /* `eager` de propósito: o retrato já está inteiro na memória (é a data-url que o vestido
         baixou), então `lazy` não economiza rede nenhuma — só atrasa o disco, e no painel do
         mestre os cards 4 e 5 ficavam CINZAS até a pessoa rolar a página até eles. Medido em
         06/10: com `lazy`, naturalWidth 0 para quem está abaixo da dobra; com `eager`, pinta. */
      img.loading = 'eager';
      caixa.appendChild(img);
    }
    if (img.getAttribute('src') !== src) {
      img.onload = function () { moldar(img, caixa, dado || { zoom: 1 }); };
      img.setAttribute('src', src);
    }
    moldar(img, caixa, dado || { zoom: 1, panX: 0, panY: 0 });
    caixa.classList.add('tem-retrato');
    return true;
  }

  global.ECLIPSE_RETRATO = { ler: ler, moldar: moldar, pintar: pintar };
  global.__RETRATO_OK = true;
})(window);
