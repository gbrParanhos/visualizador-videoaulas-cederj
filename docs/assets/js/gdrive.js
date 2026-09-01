/* ==========================================================================
   Sync do estado (EP.store) via Google Drive DO PRÓPRIO USUÁRIO.
   Não há back-end: o app só lê/escreve um arquivo JSON na conta de quem usa.

   Escopo: drive.file — o app enxerga APENAS os arquivos que ele mesmo criou.
   É o único escopo não-sensível do Drive, o que permite publicar o consent
   screen sem verificação do Google.

   Autenticação: Google Identity Services (token client). É o único fluxo
   viável numa página estática — PKCE com refresh token exigiria client_secret
   (client "Web") ou redirect em localhost (client "Desktop"), e nenhum dos dois
   serve no GitHub Pages. O token vale ~1h e fica SÓ EM MEMÓRIA, nunca em disco.
   Carregar depois de store.js.
   ========================================================================== */
(function () {
  "use strict";
  window.EP = window.EP || {};

  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var GIS_SRC = 'https://accounts.google.com/gsi/client';
  var FILE_NAME = 'videoaulas-cederj.sync.json';
  var K_FILE = 'eduplay:sync:fileId';    // cache do id p/ pular o files.list
  var K_AUTO = 'eduplay:sync:auto';      // '1' = sincronizar ao abrir
  var K_LAST = 'eduplay:sync:lastAt';
  var K_ON = 'eduplay:sync:on';          // '1' = já autorizou alguma vez

  var api = {}, tokenClient = null, token = null, tokenExp = 0, gisPromise = null;
  var pending = null;   // { resolve, reject } do pedido de token em andamento

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function ldel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  // ---- Client ID (sync-config.js) -------------------------------------------
  // Valor não-vazio não basta: um ID mal colado passaria por aqui e o usuário só
  // descobriria o erro lá na tela do Google. Confere o formato antes.
  function idOk(id) {
    return typeof id === 'string' &&
      /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(id);
  }
  api.configured = function () { return idOk(EP.SYNC_CLIENT_ID); };
  api.CONFIG_ERR = 'Client ID não configurado neste projeto — veja assets/js/sync-config.js';
  api.connected = function () { return ls(K_ON) === '1'; };
  api.autoOn = function () { return ls(K_AUTO) === '1'; };
  api.setAuto = function (on) { on ? lset(K_AUTO, '1') : ldel(K_AUTO); };
  api.lastSyncAt = function () { var v = parseInt(ls(K_LAST), 10); return isFinite(v) ? v : 0; };

  // ---- carregamento do SDK do Google ---------------------------------------
  // Injetado sob demanda (quando o menu abre), nunca no load da página: quem
  // não usa sync não paga nenhuma requisição a terceiros.
  api.loadGIS = function () {
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement('script');
      s.src = GIS_SRC; s.async = true; s.defer = true;
      s.onload = function () {
        if (window.google && google.accounts && google.accounts.oauth2) resolve();
        else reject(new Error('SDK do Google carregou incompleto'));
      };
      s.onerror = function () { reject(new Error('não foi possível carregar o Google (offline ou bloqueado)')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  };

  // callback e error_callback são lidos pelo GIS no init, então não dá para
  // trocá-los a cada pedido: eles despacham para o `pending` da vez.
  function client() {
    if (tokenClient) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: EP.SYNC_CLIENT_ID,
      scope: SCOPE,
      callback: function (resp) {
        var p = pending; pending = null;
        if (!p) return;
        if (resp && resp.access_token) {
          token = resp.access_token;
          tokenExp = Date.now() + (Number(resp.expires_in || 3600) * 1000);
          lset(K_ON, '1');
          p.resolve(token);
        } else p.reject(new Error('autorização negada'));
      },
      error_callback: function (err) {
        var p = pending; pending = null;
        if (!p) return;
        p.reject(new Error(err && err.type === 'popup_closed'
          ? 'janela de autorização fechada' : 'autorização falhou'));
      }
    });
    return tokenClient;
  }

  // silent=true → tenta renovar sem popup (prompt:''). Se a sessão do Google não
  // estiver viva, falha em silêncio; nunca abre popup não solicitado no load.
  function getToken(silent) {
    if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
    if (pending) return Promise.reject(new Error('já existe uma autorização em andamento'));
    return new Promise(function (resolve, reject) {
      var c = client();
      pending = { resolve: resolve, reject: reject };
      // o GIS pode simplesmente não chamar nada no fluxo silencioso: não deixa pendurado
      var guard = setTimeout(function () {
        if (pending) { pending = null; reject(new Error('a autorização não respondeu')); }
      }, silent ? 8000 : 120000);
      var clear = function () { clearTimeout(guard); };
      pending.resolve = function (v) { clear(); resolve(v); };
      pending.reject = function (e) { clear(); reject(e); };
      try { c.requestAccessToken(silent ? { prompt: '' } : {}); }
      catch (e) { pending = null; clear(); reject(e); }
    });
  }

  // ---- chamadas ao Drive ----------------------------------------------------
  function call(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers.Authorization = 'Bearer ' + token;
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { token = null; tokenExp = 0; var e = new Error('sessão expirou'); e.code = 401; throw e; }
      if (r.status === 403 || r.status === 429) throw new Error('o Google recusou por limite de uso — tente de novo em alguns minutos');
      if (r.status === 404) { var n = new Error('arquivo não encontrado'); n.code = 404; throw n; }
      if (!r.ok) throw new Error('Drive respondeu ' + r.status);
      return r;
    });
  }

  function findFile() {
    var cached = ls(K_FILE);
    if (cached) return Promise.resolve(cached);
    var q = encodeURIComponent("name='" + FILE_NAME + "' and trashed=false");
    return call('https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=' + q)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var id = (j.files && j.files[0] && j.files[0].id) || null;
        if (id) lset(K_FILE, id);
        return id;
      });
  }

  // Devolve { data } | { gone:true } | { data:null, corrupt:true }.
  function download(id) {
    return call('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media')
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        // arquivo corrompido/vazio: melhor sobrescrever do que travar o sync p/ sempre
        try { return { data: JSON.parse(txt) }; } catch (e) { return { data: null, corrupt: true }; }
      })
      .catch(function (e) {
        // o usuário pode ter apagado o arquivo: invalida o cache p/ recriar
        if (e.code === 404) { ldel(K_FILE); return { gone: true }; }
        throw e;
      });
  }

  function create(body) {
    var boundary = 'ep' + String(Date.now());
    var meta = { name: FILE_NAME, mimeType: 'application/json', description: 'Progresso das vídeoaulas CEDERJ (app não-oficial)' };
    var payload =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + body +
      '\r\n--' + boundary + '--';
    return call('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: payload
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (j.id) lset(K_FILE, j.id); return j.id; });
  }

  function update(id, body) {
    return call('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function () { return id; });
  }

  // ---- o ciclo completo -----------------------------------------------------
  // token → localizar → baixar → EP.store.merge → subir o resultado.
  // Sem lock: dois aparelhos sincronizando no mesmo segundo podem fazer um
  // perder a escrita do outro, mas como o merge é por item e idempotente, o
  // próximo sync recupera. É progresso de estudo, não um livro-caixa.
  function cycle() {
    return findFile()
      .then(function (id) {
        if (!id) return { id: null, data: null };
        return download(id).then(function (res) {
          // sumiu do Drive: esquece o id, senão tentaríamos atualizar o que não existe
          return res.gone ? { id: null, data: null } : { id: id, data: res.data };
        });
      })
      .then(function (got) {
        var stats = got.data ? EP.store.merge(got.data) : { pulled: 0, pushed: Object.keys(EP.store.snapshot().resume).length };
        var body = EP.store.toJSON();
        var up = got.id ? update(got.id, body) : create(body);
        return up.then(function () { lset(K_LAST, String(Date.now())); return stats; });
      });
  }

  api.sync = function (silent) {
    if (!api.configured()) return Promise.reject(new Error(api.CONFIG_ERR));
    return api.loadGIS()
      .then(function () { return getToken(!!silent); })
      .then(cycle)
      .catch(function (e) {
        // 401 no meio do ciclo: token morreu, tenta uma vez com autorização nova
        if (e && e.code === 401 && !silent) return getToken(false).then(cycle);
        throw e;
      });
  };

  // Só roda se o usuário marcou "sincronizar ao abrir" E já autorizou antes.
  api.autoSync = function () {
    if (!api.configured() || !api.autoOn() || !api.connected()) return Promise.resolve(null);
    return api.sync(true).catch(function () { return null; });   // falha em silêncio
  };

  // Esquece o aparelho. NÃO apaga nada no Drive nem o progresso local.
  api.disconnect = function () {
    if (token && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(token); } catch (e) { }
    }
    token = null; tokenExp = 0;
    ldel(K_ON); ldel(K_FILE); ldel(K_AUTO); ldel(K_LAST);
  };

  api.FILE_NAME = FILE_NAME;
  EP.drive = api;
})();
