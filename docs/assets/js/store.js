/* ==========================================================================
   Estado local do usuário: progresso das aulas + preferências.
   Formato único e versionado em localStorage['eduplay:state'], com um
   TIMESTAMP POR ITEM — é isso que permite o sync (assets/js/gdrive.js) decidir
   quem é mais recente aula a aula, sem back-end e sem coordenação.
   Não depende de rede nem do Google: export/import funcionam sozinhos.
   Carregar SEMPRE depois de core.js (core.js cria o window.EP).
   ========================================================================== */
(function () {
  "use strict";
  window.EP = window.EP || {};

  var KEY = 'eduplay:state';
  var LEGACY_RESUME = 'eduplay:resume:';       // formato antigo: 1 chave por aula
  var LEGACY_STRIP = 'eduplay:stripCollapsed';
  var VERSION = 2;   // v2 acrescentou `done` (assistida) e `dur` (duração da aula)
  var TOMB_TTL = 180 * 24 * 3600 * 1000;       // poda "aula concluída" após 180 dias
  var SKEW = 5 * 60 * 1000;                    // tolerância p/ relógio adiantado

  var api = {}, state = null;

  // Cada item é um par [valor, updatedAt]. Array (não objeto) porque o arquivo
  // que sobe pro Drive fica ~3x menor: 460 aulas ≈ 15 KB.
  // resume/done/prefs são pares [valor, updatedAt] (mergeáveis por recência).
  // dur é um mapa simples id->segundos: a duração do vídeo é um fato objetivo,
  // igual em todo aparelho, então não há conflito que precise de timestamp.
  function blank() { return { v: VERSION, resume: {}, done: {}, dur: {}, prefs: {}, updatedAt: 0 }; }
  function pair(v, t) { return [v, t || Date.now()]; }
  function tsOf(e) { return (e && typeof e[1] === 'number' && isFinite(e[1])) ? e[1] : 0; }

  // ---- migração one-shot do formato antigo ----------------------------------
  // Usa Date.now() (e não 0) de propósito: o que está NESTE aparelho é o que o
  // usuário tem agora e deve vencer um remoto antigo. Se dois aparelhos migrarem,
  // o que sincronizar por último vence — só nessa primeira rodada.
  function migrate() {
    var s = blank(), t = Date.now(), legacy = [], i, k, v = null;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf(LEGACY_RESUME) === 0) legacy.push(k);
      }
      legacy.forEach(function (key) {
        var sec = parseFloat(localStorage.getItem(key));
        if (isFinite(sec) && sec > 0) s.resume[key.slice(LEGACY_RESUME.length)] = pair(Math.floor(sec), t);
        localStorage.removeItem(key);
      });
      v = localStorage.getItem(LEGACY_STRIP);
      if (v !== null) { s.prefs.stripCollapsed = pair(v === '1', t); localStorage.removeItem(LEGACY_STRIP); }
    } catch (e) { }
    if (legacy.length || v !== null) s.updatedAt = t;
    return s;
  }

  function read() {
    if (state) return state;
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { }
    if (raw) { state = sanitize(JSON.parse(raw)); }
    else { state = migrate(); save(); }
    return state;
  }

  function save() {
    prune(state);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
  }

  // Remove tombstones velhos (progresso 0, "não assistida"), p/ o arquivo não
  // crescer para sempre.
  function prune(s) {
    var cut = Date.now() - TOMB_TTL;
    Object.keys(s.resume).forEach(function (id) {
      var e = s.resume[id];
      if (!e || (e[0] === 0 && tsOf(e) < cut)) delete s.resume[id];
    });
    Object.keys(s.done).forEach(function (id) {
      var e = s.done[id];
      if (!e || (e[0] === false && tsOf(e) < cut)) delete s.done[id];
    });
  }

  // Valida um state vindo de fora (Drive ou arquivo importado) e joga fora lixo.
  // Timestamps são limitados a agora+5min: um aparelho com relógio adiantado
  // não pode congelar o estado de todos os outros.
  function sanitize(o) {
    var s = blank(), max = Date.now() + SKEW;
    if (!o || typeof o !== 'object') return s;
    if (o.resume && typeof o.resume === 'object') {
      Object.keys(o.resume).forEach(function (id) {
        var e = o.resume[id];
        if (!e || e.length !== 2) return;
        var sec = Number(e[0]), t = Number(e[1]);
        if (!isFinite(sec) || sec < 0 || !isFinite(t) || t <= 0) return;
        s.resume[String(id)] = [Math.floor(sec), Math.min(t, max)];
      });
    }
    if (o.done && typeof o.done === 'object') {
      Object.keys(o.done).forEach(function (id) {
        var e = o.done[id];
        if (!e || e.length !== 2) return;
        var t = Number(e[1]);
        if (!isFinite(t) || t <= 0) return;
        s.done[String(id)] = [e[0] === true, Math.min(t, max)];
      });
    }
    if (o.dur && typeof o.dur === 'object') {
      Object.keys(o.dur).forEach(function (id) {
        var d = Number(o.dur[id]);
        if (isFinite(d) && d > 0) s.dur[String(id)] = Math.round(d);
      });
    }
    if (o.prefs && typeof o.prefs === 'object') {
      Object.keys(o.prefs).forEach(function (k) {
        var e = o.prefs[k];
        if (!e || e.length !== 2) return;
        var t = Number(e[1]);
        if (!isFinite(t) || t <= 0) return;
        s.prefs[k] = [e[0], Math.min(t, max)];
      });
    }
    s.updatedAt = Math.min(Number(o.updatedAt) || 0, max);
    return s;
  }

  // ---- API de leitura/escrita (substitui o localStorage cru do player) ------
  api.getResume = function (id) {
    var e = read().resume[String(id)];
    return (e && e[0] > 0) ? e[0] : 0;
  };
  api.setResume = function (id, sec) {
    if (!id || !isFinite(sec) || sec <= 0) return;
    var s = read();
    s.resume[String(id)] = pair(Math.floor(sec));
    s.updatedAt = Date.now(); save();
  };
  // Grava um TOMBSTONE [0, agora] em vez de apagar: sem isso, um aparelho que
  // ainda tem o progresso antigo ressuscitaria a aula já concluída no próximo sync.
  api.clearResume = function (id) {
    if (!id) return;
    var s = read();
    s.resume[String(id)] = pair(0);
    s.updatedAt = Date.now(); save();
  };
  // ---- aula assistida (boolean) --------------------------------------------
  api.isDone = function (id) {
    var e = read().done[String(id)];
    return !!(e && e[0] === true);
  };
  // Grava [false, agora] em vez de apagar, pelo mesmo motivo do tombstone do
  // resume: um aparelho atrasado não pode remarcar como assistida o que foi
  // desmarcado aqui.
  api.setDone = function (id, feito) {
    if (!id) return;
    var s = read();
    s.done[String(id)] = pair(feito === true);
    s.updatedAt = Date.now(); save();
  };

  // ---- duração da aula (para calcular a %) ---------------------------------
  api.getDuration = function (id) { return read().dur[String(id)] || 0; };
  api.setDuration = function (id, sec) {
    if (!id || !isFinite(sec) || sec <= 0) return;
    var s = read(), k = String(id), v = Math.round(sec);
    if (s.dur[k] === v) return;            // evita gravar a cada carregamento
    s.dur[k] = v;
    s.updatedAt = Date.now(); save();
  };

  // ---- percentuais ----------------------------------------------------------
  // % da aula: posição guardada / duração. 100 só quando marcada como assistida,
  // então "100%" e "✓ assistida" nunca se contradizem na tela.
  api.pctOf = function (id) {
    if (api.isDone(id)) return 100;
    var d = api.getDuration(id), r = api.getResume(id);
    if (!d || !r) return 0;
    return Math.max(1, Math.min(99, Math.floor(r / d * 100)));
  };

  // % da matéria: quantas aulas da lista estão marcadas como assistidas.
  api.progressOf = function (ids) {
    var total = ids.length, feitas = 0;
    ids.forEach(function (id) { if (api.isDone(id)) feitas++; });
    return { feitas: feitas, total: total, pct: total ? Math.round(feitas / total * 100) : 0 };
  };

  api.getPref = function (k, def) {
    var e = read().prefs[k];
    return e ? e[0] : def;
  };
  api.setPref = function (k, v) {
    var s = read();
    s.prefs[k] = pair(v);
    s.updatedAt = Date.now(); save();
  };

  // ---- sync -----------------------------------------------------------------
  api.snapshot = function () { return JSON.parse(JSON.stringify(read())); };

  // Funde um state externo no local. Por ITEM, nunca pelo blob inteiro: maior
  // timestamp vence. Comutativo e idempotente, então converge sem coordenação —
  // é o que dispensa o back-end.
  api.merge = function (incoming) {
    var remote = sanitize(incoming), local = read();
    var pulled = 0, pushed = 0;

    function fuse(bag) {
      Object.keys(remote[bag]).forEach(function (k) {
        var r = remote[bag][k], l = local[bag][k];
        if (!l || tsOf(r) > tsOf(l)) { local[bag][k] = r; pulled++; }
        else if (tsOf(r) < tsOf(l)) pushed++;
      });
      Object.keys(local[bag]).forEach(function (k) { if (!remote[bag][k]) pushed++; });
    }
    fuse('resume'); fuse('done'); fuse('prefs');

    // dur não tem timestamp (é fato objetivo): união simples, o que já existe
    // aqui foi medido do vídeo real e prevalece.
    Object.keys(remote.dur).forEach(function (id) {
      if (!local.dur[id]) { local.dur[id] = remote.dur[id]; pulled++; }
    });
    Object.keys(local.dur).forEach(function (id) { if (!remote.dur[id]) pushed++; });

    local.updatedAt = Date.now(); save();
    return { pulled: pulled, pushed: pushed };
  };

  // ---- backup em arquivo ----------------------------------------------------
  api.toJSON = function () { return JSON.stringify(read()); };
  api.fromJSON = function (str) { return api.merge(JSON.parse(str)); };

  api.KEY = KEY;
  EP.store = api;
})();
