/* ==========================================================================
   Página da galeria de slides (slides.html?id=<id>).
   Mostra todos os slides da aula para consulta. F5 mantém a mesma aula.
   ========================================================================== */
(function () {
  "use strict";

  document.body.style.overflow = 'hidden';

  EP.load(function () {
    var id = EP.param('id');
    var found = id ? EP.findAula(id) : null;
    if (!found) { location.replace('../index.html'); return; }
    render(found.aula, found.disc);
  }, function (e) {
    var gt = document.getElementById('gtitle');
    if (gt) gt.textContent = 'Erro ao carregar dados — veja o README (' + String(e && e.message || e) + ')';
  });

  function render(aula, disc) {
    var esc = EP.esc, fmt = EP.fmt;
    var gscroll = document.getElementById('gscroll'), gtitle = document.getElementById('gtitle');
    var sl = EP.slidesFor(aula.id);

    document.title = EP.discCode(disc) + ' · ' + aula.label + ' · slides';
    gtitle.innerHTML = esc(EP.discCode(disc) + ' · ' + aula.label) + ' <small>· ' + sl.length + ' slides</small>';

    var html = '';
    sl.forEach(function (s, i) {
      html += '<div class="gslide"><div class="cap"><b>Slide ' + (i + 1) + ' / ' + sl.length + '</b>' +
        '<span class="ts">▶ ' + fmt(s.vlStart) + '</span></div><img loading="lazy" src="' + s.src + '"></div>';
    });
    gscroll.innerHTML = html || '<p class="empty">Esta aula não tem slides.</p>';
    gscroll.scrollTop = 0;

    document.getElementById('gwatch').addEventListener('click', function () {
      location.href = 'player.html?id=' + encodeURIComponent(aula.id);
    });
    document.getElementById('gExit').addEventListener('click', function () { location.href = '../index.html'; });
  }
})();
