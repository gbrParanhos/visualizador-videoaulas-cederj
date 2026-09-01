/* ==========================================================================
   Menu ☁ do catálogo: conectar/sincronizar com o Drive + backup em arquivo.
   O SDK do Google é carregado quando o MENU ABRE (não no clique do botão):
   se carregasse no clique, o await mataria o gesto do usuário e o navegador
   bloquearia o popup de autorização.
   Carregar depois de gdrive.js.
   ========================================================================== */
(function () {
  "use strict";

  var btn = document.getElementById('syncBtn');
  if (!btn) return;
  var panel = null, fileInput = null, busy = false;

  // ---- toast ----------------------------------------------------------------
  var toastEl = null, toastT = null;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.className = ''; }, 4200);
  }

  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function ago(ts) {
    if (!ts) return 'nunca';
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'agora mesmo';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    return 'há ' + Math.floor(s / 86400) + ' dia(s)';
  }

  // ---- painel ---------------------------------------------------------------
  function build() {
    panel = document.createElement('div');
    panel.id = 'syncPanel';
    panel.hidden = true;
    fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true;
    fileInput.addEventListener('change', onImport);
    panel.appendChild(fileInput);
    btn.parentNode.appendChild(panel);
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function render() {
    var D = EP.drive, rows = [];

    if (!D.configured()) {
      rows.push('<p class="sync-state warn">Sincronização não configurada neste projeto.</p>');
      rows.push('<p class="sync-note">Falta o <b>Client ID</b> do Google em ' +
        '<code>assets/js/sync-config.js</code> — ele precisa terminar em ' +
        '<code>.apps.googleusercontent.com</code>. Passo a passo no README.<br>' +
        'O backup por arquivo abaixo funciona mesmo assim.</p>');
    } else if (!D.connected()) {
      rows.push('<p class="sync-state">Seu progresso está só neste aparelho.</p>');
      rows.push('<button class="act play" data-do="connect">Conectar Google Drive</button>');
      rows.push('<p class="sync-note">Cria um arquivo <b>' + EP.esc(D.FILE_NAME) + '</b> no <b>seu</b> Drive. ' +
        'O app só enxerga esse arquivo — nada mais da sua conta.</p>');
    } else {
      rows.push('<p class="sync-state ok">Conectado ao Google Drive</p>');
      rows.push('<button class="act play" data-do="sync">☁ Sincronizar agora</button>');
      rows.push('<p class="sync-note">Última sincronização: <b>' + ago(D.lastSyncAt()) + '</b></p>');
      rows.push('<label class="sync-check"><input type="checkbox" data-do="auto"' + (D.autoOn() ? ' checked' : '') +
        '> Sincronizar automaticamente ao abrir</label>');
    }

    rows.push('<hr class="sync-sep">');
    rows.push('<div class="sync-row">' +
      '<button class="act" data-do="export">⬇ Exportar backup</button>' +
      '<button class="act" data-do="import">⬆ Importar backup</button></div>');
    if (D.connected()) rows.push('<button class="sync-link" data-do="disconnect">Desconectar este aparelho</button>');

    // innerHTML recria o <input file>; guarda e recoloca.
    panel.removeChild(fileInput);
    panel.innerHTML = rows.join('');
    panel.appendChild(fileInput);
  }

  function open() {
    render();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // pré-carrega o SDK agora, para o clique em Conectar/Sincronizar ser um
    // gesto limpo e o popup não ser bloqueado.
    if (EP.drive.configured()) EP.drive.loadGIS().catch(function () { });
  }
  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  // ---- ações ----------------------------------------------------------------
  function doSync() {
    if (busy) return;
    busy = true; btn.classList.add('spin'); toast('Sincronizando…');
    EP.drive.sync(false).then(function (st) {
      toast(st.pulled ? 'Sincronizado · ' + plural(st.pulled, 'alteração recebida', 'alterações recebidas')
        : 'Sincronizado · já estava tudo em dia', 'ok');
      document.dispatchEvent(new CustomEvent('ep:synced'));
      render();
    }).catch(function (e) {
      toast('Não deu para sincronizar: ' + (e && e.message || e), 'err');
      render();
    }).then(function () { busy = false; btn.classList.remove('spin'); });
  }

  function doExport() {
    var blob = new Blob([EP.store.toJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'videoaulas-cederj-backup.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Backup exportado', 'ok');
  }

  function onImport() {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var st = EP.store.fromJSON(String(rd.result));
        toast(st.pulled ? 'Importado · ' + plural(st.pulled, 'alteração aplicada', 'alterações aplicadas')
          : 'Importado · nada de novo no arquivo', 'ok');
        document.dispatchEvent(new CustomEvent('ep:synced'));
      } catch (e) { toast('Arquivo inválido: ' + (e && e.message || e), 'err'); }
      fileInput.value = '';
    };
    rd.onerror = function () { toast('Não deu para ler o arquivo', 'err'); fileInput.value = ''; };
    rd.readAsText(f);
  }

  // ---- eventos --------------------------------------------------------------
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!panel) build();
    panel.hidden ? open() : close();
  });

  document.addEventListener('click', function (e) {
    if (!panel || panel.hidden) return;
    var el = e.target.closest ? e.target.closest('[data-do]') : null;
    if (!el || !panel.contains(el)) return;
    var act = el.getAttribute('data-do');
    if (act === 'connect' || act === 'sync') { doSync(); }
    else if (act === 'export') { doExport(); }
    else if (act === 'import') { fileInput.click(); }
    else if (act === 'disconnect') { EP.drive.disconnect(); render(); toast('Aparelho desconectado (nada foi apagado)'); }
  });

  document.addEventListener('change', function (e) {
    if (!panel || panel.hidden || !panel.contains(e.target)) return;
    if (e.target.getAttribute('data-do') !== 'auto') return;
    EP.drive.setAuto(e.target.checked);
    toast(e.target.checked ? 'Vai sincronizar sozinho ao abrir' : 'Sincronização automática desligada');
  });

  // ---- auto-sync ao abrir (só se o usuário marcou) ---------------------------
  EP.drive.autoSync().then(function (st) {
    if (st && st.pulled) {
      toast('Sincronizado · ' + plural(st.pulled, 'alteração recebida', 'alterações recebidas'), 'ok');
      document.dispatchEvent(new CustomEvent('ep:synced'));
    }
  });
})();
