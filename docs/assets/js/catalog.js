/* ==========================================================================
   Página do catálogo (index.html).
   Lista disciplinas/aulas e leva para player.html?id=... ou slides.html?id=...
   ========================================================================== */
(function () {
  "use strict";

  EP.load(build, function (e) {
    var list = document.getElementById('list');
    if (list) {
      list.innerHTML = '<p class="empty">Não foi possível carregar os dados (assets/data/data.json).<br>' +
        'Se você abriu o arquivo direto do disco, rode um servidor local — veja o README.<br>' +
        '<small>' + EP.esc(String(e && e.message || e)) + '</small></p>';
    }
  });

  // O sync/import pode terminar ANTES do catálogo montar: registra o listener já,
  // e se ainda não montou não faz nada — a montagem lê o store atualizado de qualquer jeito.
  var redesenhar = null;
  document.addEventListener('ep:synced', function () { if (redesenhar) redesenhar(); });

  function go(id, gallery) {
    location.href = 'pages/' + (gallery ? 'slides.html' : 'player.html') + '?id=' + encodeURIComponent(id);
  }

  function build() {
    var esc = EP.esc;
    var listEl = document.getElementById('list'), searchEl = document.getElementById('search'), footEl = document.getElementById('foot');
    var CAT = EP.catalog;
    var order = [], groups = {};
    CAT.forEach(function (d) { if (!groups[d.periodo]) { groups[d.periodo] = []; order.push(d.periodo); } groups[d.periodo].push(d); });
    var totalAulas = CAT.reduce(function (s, d) { return s + d.aulas.length; }, 0), comSlides = Object.keys(EP.slides).length;
    footEl.textContent = CAT.length + ' disciplinas · ' + totalAulas + ' aulas · ' + comSlides + ' com slides sincronizados · fonte: cecierj.edu.br / eduplay.rnp.br';

    // ---- progresso (assistidas / %) ----
    // Linha da aula: "✓ assistida" ou "parou em 12:22 · 34%".
    function progressoDe(id) {
      if (EP.store.isDone(id)) return '<small class="done">✓ assistida</small>';
      var r = EP.store.getResume(id), pct = EP.store.pctOf(id);
      if (!r) return '';
      return '<small class="resume">▶ parou em ' + EP.fmt(r * 1000) + (pct ? ' · ' + pct + '%' : '') + '</small>';
    }
    // % da matéria = aulas marcadas como assistidas / aulas que existem de fato.
    // Sempre sobre a disciplina INTEIRA, mesmo com a busca filtrando a lista.
    function pintaDisc(det, d) {
      var ids = d.aulas.filter(function (a) { return !a.na; }).map(function (a) { return a.id; });
      var p = EP.store.progressOf(ids);
      var el = det.querySelector('.disc-prog');
      el.textContent = p.feitas + '/' + p.total + ' · ' + p.pct + '%';
      el.title = p.feitas + ' de ' + p.total + ' aulas assistidas';
      det.querySelector('.disc-bar > i').style.width = p.pct + '%';
      det.classList.toggle('completa', p.total > 0 && p.feitas === p.total);
    }
    function pintaLinha(row, a) {
      var feito = EP.store.isDone(a.id);
      row.querySelector('.prog').innerHTML = progressoDe(a.id);
      row.classList.toggle('watched', feito);
      var b = row.querySelector('.act.done');
      if (b) {
        b.setAttribute('aria-pressed', feito ? 'true' : 'false');
        b.title = feito ? 'Desmarcar aula assistida' : 'Marcar aula como assistida';
      }
    }

    function buildCatalog(filter) {
      filter = (filter || '').trim().toLowerCase();
      // guarda quais disciplinas estavam abertas: redesenhamos a lista inteira
      // ao marcar/sincronizar, e fechar tudo no meio do uso seria irritante.
      var abertas = {}, jaAbertas = listEl.querySelectorAll('details.disc[open]');
      for (var q = 0; q < jaAbertas.length; q++) abertas[jaAbertas[q].getAttribute('data-code')] = 1;
      listEl.innerHTML = ''; var any = false;
      order.forEach(function (periodo) {
        var pWrap = document.createElement('div'); pWrap.className = 'period';
        var h2 = document.createElement('h2'); h2.textContent = periodo; pWrap.appendChild(h2); var shown = 0;
        groups[periodo].forEach(function (d) {
          var matName = d.materia.toLowerCase(), aulas = d.aulas;
          if (filter) { if (matName.indexOf(filter) < 0) { aulas = d.aulas.filter(function (a) { return a.label.toLowerCase().indexOf(filter) >= 0; }); if (!aulas.length) return; } }
          shown++; any = true;
          var det = document.createElement('details'); det.className = 'disc';
          var code = EP.discCode(d), name = d.materia.slice(code.length).replace(/^\s*-\s*/, '');
          det.setAttribute('data-code', code);
          if (filter || abertas[code]) det.open = true;
          var brokenCount = aulas.filter(function (a) { return a.na || !EP.playable(a.id); }).length;
          var sum = document.createElement('summary');
          sum.innerHTML = '<span class="chev">▶</span><span class="disc-name"><span class="disc-code">' + esc(code) + '</span>' + (name ? ' · ' + esc(name) : '') + '</span>' +
            (brokenCount ? '<span class="disc-warn" title="aulas sem vídeo (abrem no EduPlay ou indisponíveis)">⚠ ' + brokenCount + '</span>' : '') +
            '<span class="disc-prog"></span>' +
            '<span class="disc-count">' + d.aulas.length + '</span>' +
            '<span class="disc-bar"><i></i></span>';
          det.appendChild(sum);
          var lw = document.createElement('div'); lw.className = 'lessons';
          aulas.forEach(function (a) {
            var n = (a.label.match(/(\d+[A-Za-z-]*)/) || [, '•'])[1];
            // aula indisponível na fonte (sem vídeo): só alerta, sem botões
            if (a.na) {
              var rna = document.createElement('div'); rna.className = 'lesson broken';
              rna.innerHTML = '<span class="num">' + esc(n) + '</span><span class="lbl">' + esc(a.label) +
                '<small class="warn">⚠ aula indisponível na fonte</small></span>';
              lw.appendChild(rna); return;
            }
            var has = EP.hasSlides(a.id), mp4 = EP.hasMp4(a.id), viaHls = (!mp4 && EP.hasHls(a.id)), broken = !EP.playable(a.id);
            var row = document.createElement('div'); row.className = 'lesson' + (broken ? ' broken' : '');
            var sub;
            if (broken) { sub = '<small class="warn">⚠ vídeo indisponível · abre no EduPlay</small>'; }
            else {
              var base = has ? ('▦ ' + EP.slides[a.id].s.length + ' slides sincronizados') : 'só vídeo';
              sub = '<small' + (has ? ' class="slides"' : '') + '>' + base + (viaHls ? ' · <span class="alt">fonte alt.</span>' : '') + '</small>';
            }
            row.innerHTML = '<span class="num">' + esc(n) + '</span><span class="lbl">' + esc(a.label) + sub +
              '<span class="prog"></span></span>' +
              '<button class="act done" aria-pressed="false">✓</button>' +
              '<button class="act slides"' + (has ? '' : ' disabled') + '>▦ Slides</button>' +
              '<button class="act play">▶</button>';
            row.querySelector('.lbl').addEventListener('click', function () { go(a.id, false); });
            row.querySelector('.act.play').addEventListener('click', function (e) { e.stopPropagation(); go(a.id, false); });
            if (has) row.querySelector('.act.slides').addEventListener('click', function (e) { e.stopPropagation(); go(a.id, true); });
            // marcar/desmarcar na própria listagem, sem abrir a aula
            row.querySelector('.act.done').addEventListener('click', (function (det, d) {
              return function (e) {
                e.stopPropagation();
                EP.store.setDone(a.id, !EP.store.isDone(a.id));
                pintaLinha(row, a); pintaDisc(det, d);
              };
            })(det, d));
            pintaLinha(row, a);
            lw.appendChild(row);
          });
          det.appendChild(lw); pintaDisc(det, d); pWrap.appendChild(det);
        });
        if (shown) listEl.appendChild(pWrap);
      });
      if (!any) listEl.innerHTML = '<p class="empty">Nada encontrado para "' + esc(filter) + '".</p>';
    }
    var stt; searchEl.addEventListener('input', function () { clearTimeout(stt); stt = setTimeout(function () { buildCatalog(searchEl.value); }, 120); });

    redesenhar = function () { buildCatalog(searchEl.value); };
    buildCatalog('');
  }
})();
