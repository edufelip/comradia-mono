/* Cravos layer, injected into a static capture of the real Comradia web build.
   Every value below is copied from apps/mobile/constants/design-system.ts (getDsTheme, DsTypography,
   DsSpace, DsRadius, DsShadow, DsLayout, DsBorder) or constants/motion.ts (DS_MOTION), or from the
   StyleSheet of the primitive named next to it. Values marked PROPOSED do not exist in the repo. */
(function () {
  'use strict';
  var THEME = {
    light: { canvas:'#FBF6F4', surface:'#ffffff', surfaceMuted:'#f7eeeb', surfaceElevated:'#ffffff', textPrimary:'#231214', textSecondary:'#7A5A5C', textTertiary:'#866567', accentPrimary:'#D92D3A', actionPrimary:'#231214', onActionPrimary:'#ffffff', accentPrimarySoft:'#FCE8E9', accentText:'#B8222E', accentWarm:'#E05A47', disabledSurface:'#f0e8e6', disabledText:'#7A5A5C', disabledBorder:'#e8dfdc', success:'#1b7447', successSoft:'#e3efe6', danger:'#C42431', border:'#e8dfdc', borderStrong:'#d9cbca', accentCyan:'#06b6d4', accentCyanSoft:'#06b6d420', overlayNeutral:'rgba(35, 18, 20, 0.32)' },
    dark:  { canvas:'#181112', surface:'#231719', surfaceMuted:'#2e1e20', surfaceElevated:'#2a1b1d', textPrimary:'#fbf6f4', textSecondary:'#c4a6a8', textTertiary:'#a48a8c', accentPrimary:'#E05A47', actionPrimary:'#fbf6f4', onActionPrimary:'#181112', accentPrimarySoft:'#e05a4729', accentText:'#f27e6e', accentWarm:'#f28a7c', disabledSurface:'#2e1e20', disabledText:'#c4a6a8', disabledBorder:'#3d282a', success:'#4ade80', successSoft:'#16301f', danger:'#f87171', border:'#3d282a', borderStrong:'#523639', accentCyan:'#22d3ee', accentCyanSoft:'#22d3ee29', overlayNeutral:'rgba(8, 8, 8, 0.48)' }
  };
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';           // DS_MOTION.easing.easeOut
  var MS = { fast: 120, standard: 220, slow: 360, countUp: 600 /* PROPOSED */, celebrate: 900 /* PROPOSED */ };
  var TIER = { b: '#B5703F', s: '#8C97A3', g: '#C9961E' }; // PROPOSED DsAchievementTier (fixed, like DsArt)
  var GLYPH = { florist:0xe545, forum:0xe0bf, chat:0xe0cb, event:0xe614, edit:0xe745, groups:0xf233, spa:0xeb4c, favorite:0xe87d, shield:0xe9e0, verified:0xe8e8, bedtime:0xef44, history:0xe889, lock:0xe899, trophy:0xea23, star:0xe838, close:0xe5cd };
  var g = function (k) { return String.fromCodePoint(GLYPH[k] || GLYPH.florist); };

  var S = { scheme: 'light', rm: false, scene: null, timers: [], rafs: [] };
  var C = function () { return THEME[S.scheme]; };
  function later(fn, ms) { var t = setTimeout(fn, ms); S.timers.push(t); return t; }
  function clearAll() { S.timers.forEach(clearTimeout); S.rafs.forEach(cancelAnimationFrame); S.timers = []; S.rafs = []; }
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };   // Easing.out(Easing.cubic), as in MatchCelebration
  function tween(ms, fn, done) {
    if (S.rm) { fn(1); if (done) done(); return; }
    var s = performance.now();
    var step = function (now) { var p = Math.min(1, (now - s) / ms); fn(easeOut(p)); if (p < 1) S.rafs.push(requestAnimationFrame(step)); else if (done) done(); };
    S.rafs.push(requestAnimationFrame(step));
  }
  var fmt = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  var tid = function (id) { return document.querySelector('[data-testid="' + id + '"]'); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function leafByText(txt) {
    var want = txt.trim().toLowerCase(), all = document.querySelectorAll('#root div, #root span, #root h1, #root h2');
    for (var i = 0; i < all.length; i++) { var n = all[i]; if (n.children.length === 0 && n.textContent.trim().toLowerCase() === want) return n; }
    return null;
  }
  function climbUntil(node, pred) { while (node && node.parentElement && !pred(node.parentElement)) node = node.parentElement; return node; }
  function scroller(from) { var n = from; while (n && n !== document.body) { var o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return null; }

  /* Fixture copy: the atlas fixtures write user-generated text in English. Only that text is
     translated here; every interface string on these screens is the app's own pt-BR. */
  var FIXTURE_PT = {
    'Hello Maya, the garden sounds lovely.': 'Oi Maya, a horta parece ótima.',
    'Shall we visit the community garden?': 'Vamos conhecer a horta comunitária?',
    'Feira, then a long lunch.': 'Feira, depois um almoço longo.',
    'A community garden together.': 'Uma horta comunitária, juntos.'
  };
  function translateFixtures() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var k = n.nodeValue.trim(); if (FIXTURE_PT[k]) n.nodeValue = FIXTURE_PT[k]; }
  }

  function css() {
    var c = C();
    return ':root{' + Object.keys(c).map(function (k) { return '--' + k + ':' + c[k]; }).join(';') + '}' +
    /* DsTypography */
    '.gx-t{margin:0;white-space:pre-wrap;overflow-wrap:break-word}' +
    '.gx-micro{font-family:Geist_500Medium;font-size:11px;line-height:14px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--accentText)}' +
    '.gx-figure{font-family:Geist_700Bold;font-size:32px;line-height:38px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--textPrimary)}' +
    '.gx-cardTitle{font-family:Geist_700Bold;font-size:16px;line-height:22px;font-weight:700;color:var(--textPrimary)}' +
    '.gx-heading{font-family:Geist_700Bold;font-size:20px;line-height:26px;font-weight:700;color:var(--textPrimary)}' +
    '.gx-body{font-family:Geist_400Regular;font-size:14px;line-height:20px;font-weight:400;color:var(--textPrimary)}' +
    '.gx-caption{font-family:Geist_400Regular;font-size:12px;line-height:16px;font-weight:400;font-variant-numeric:tabular-nums;color:var(--textSecondary)}' +
    '.gx-label{font-family:Geist_700Bold;font-size:13px;line-height:18px;font-weight:700;color:var(--textPrimary)}' +
    '.gx-button{font-family:Geist_500Medium;font-size:14px;line-height:20px;font-weight:500;text-align:center}' +
    '.gx-icon{font-family:material;font-weight:normal;font-style:normal;font-size:24px;line-height:24px;display:inline-block;color:var(--accentText)}' +
    /* DsCard: radius lg 16, padding lg 20, surface; profile `card` style adds gap xs 8 */
    '.gx-card{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:20px;border-radius:16px;background:var(--surface);position:relative}' +
    '.gx-row{display:flex;flex-direction:row;align-items:center;gap:8px}.gx-between{justify-content:space-between}' +
    /* profile valueChip: radius sm 12, padding 4/12, surfaceMuted, caption textSecondary */
    '.gx-chip{display:inline-flex;align-items:center;gap:4px;border-radius:12px;padding:4px 12px;background:var(--surfaceMuted);align-self:flex-start}' +
    /* DsPillButton: pill, padding 0 16, md minHeight 46 (DsLayout.controlHeight), sm 44 */
    '.gx-pill{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:9999px;padding:0 16px;min-height:46px;border:1px solid var(--surfaceMuted);background:var(--surfaceMuted);color:var(--textPrimary);cursor:pointer}' +
    '.gx-pill.primary{background:var(--actionPrimary);border-color:var(--actionPrimary);color:var(--onActionPrimary)}' +
    '.gx-pill.disabled{background:var(--disabledSurface);border-color:var(--disabledBorder);color:var(--disabledText);cursor:default}' +
    '.gx-pill.sm{min-height:44px}' +
    /* DsPillButton variant="ghost": transparent, no border */
    '.gx-pill.ghost{background:transparent;border-color:transparent}' +
    /* PROPOSED DsNotice onClose: 44 pt target (DsLayout.minTouchTarget), 20 pt close glyph in textSecondary,
       centred on the title line; the glyph's right edge lines up with the card's 20 pt padding. */
    '.gx-close{all:unset;box-sizing:border-box;position:absolute;top:9px;right:8px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer;pointer-events:auto}' +
    '.gx-close:focus-visible{outline:3px solid var(--accentPrimary);outline-offset:-3px}' +
    '.gx-close .gx-icon{font-size:20px;line-height:20px;color:var(--textSecondary)}' +
    '.gx-notice .content.has-close{padding-right:24px}' +
    /* DsDivider: hairline border */
    '.gx-div{height:1px;background:var(--border);margin:4px 0}' +
    /* PROPOSED DsProgressBar: 8 high, pill, surfaceMuted track */
    '.gx-bar{height:8px;border-radius:9999px;background:var(--surfaceMuted);overflow:hidden}.gx-bar>b{display:block;height:100%;width:0;border-radius:9999px;background:var(--accentPrimary)}' +
    '.gx-ledger{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0}' +
    '.gx-pos{color:var(--success)}.gx-neg{color:var(--danger)}' +
    /* DsNotice overlay (PushNotificationBridge banner: marginHorizontal 16, marginTop 8, zIndex 3) */
    '.gx-notice-wrap{position:fixed;left:16px;right:16px;top:8px;z-index:3;pointer-events:none}' +
    '.gx-notice{flex-direction:row;gap:12px;box-shadow:0 10px 24px rgba(0,0,0,0.12)}' +
    '.gx-notice .tint{position:absolute;inset:0;border-radius:16px;background:var(--accentPrimarySoft);pointer-events:none}' +
    '.gx-notice .ic{position:relative;flex:none;width:24px;height:24px}' +
    '.gx-notice .content{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}' +
    '.gx-petal{position:absolute;left:9px;top:9px;width:6px;height:6px;border-radius:9999px;opacity:0}' +
    /* streak */
    '.gx-weeks{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-top:4px}' +
    '.gx-wk{display:flex;flex-direction:column;align-items:center;gap:4px}' +
    '.gx-wk i{display:block;width:20px;height:20px;border-radius:9999px;box-sizing:border-box;border:1.5px solid var(--borderStrong)}' +
    '.gx-wk.done i{background:var(--accentPrimary);border-color:var(--accentPrimary)}' +
    '.gx-wk.pause i{background:var(--accentCyanSoft);border:1.5px dashed var(--accentCyan)}' +
    '.gx-wk.now i{border-color:var(--accentPrimary)}' +
    '.gx-ring{width:64px;height:64px;flex:none;position:relative}.gx-ring svg{width:64px;height:64px;transform:rotate(-90deg)}' +
    '.gx-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
    /* catalog */
    '.gx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px}' +
    '.gx-tile{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 2px;border-radius:12px;min-height:44px;text-align:center}' +
    '.gx-tile:hover{background:var(--surfaceMuted)}.gx-tile:focus-visible{outline:3px solid var(--focusRing,#1f7a4c);outline-offset:2px}' +
    '.gx-tile.locked svg{opacity:.4;filter:grayscale(1)}' +
    /* DsSheet: overlayNeutral scrim; sheet surfaceElevated, top radius xxl 20, padding 12/20; grab 40x4 borderStrong */
    '.gx-sheet-wrap{position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:flex-end}' +
    '.gx-scrim{position:absolute;inset:0;background:var(--overlayNeutral)}' +
    '.gx-sheet{position:relative;background:var(--surfaceElevated);border-top-left-radius:20px;border-top-right-radius:20px;padding:12px 20px 28px;display:flex;flex-direction:column;align-items:stretch}' +
    '.gx-grab{align-self:center;width:40px;height:4px;border-radius:9999px;background:var(--borderStrong);margin-bottom:8px}' +
    '.gx-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:11}';
  }
  function applyTheme() { var s = document.getElementById('gx-style'); if (!s) { s = el('style'); s.id = 'gx-style'; document.head.appendChild(s); } s.textContent = css(); }

  /* ---------- medal (PROPOSED DsAchievementMedal) ---------- */
  function mix(a, b, t) {
    var p = function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); };
    var x = p(a), y = p(b);
    return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join('');
  }
  /* PROPOSED DsAchievementMedal: a bevelled metal rim (light top-left, dark bottom-right), a face
     tinted with the tier on the card surface, and the glyph centred in a deep tier shade. The tier
     name is never drawn inside the medal; it sits in the copy or a chip next to it. */
  function medal(size, tier, glyph) {
    var c = C(), t = TIER[tier], dark = S.scheme === 'dark';
    var hi = mix(t, '#ffffff', 0.45), lo = mix(t, '#000000', 0.32);
    var face = mix(c.surface, t, dark ? 0.16 : 0.1), ink = dark ? mix(t, '#ffffff', 0.35) : mix(t, '#000000', 0.38);
    var id = 'gxm' + tier + S.scheme;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 132 132" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset=".5" stop-color="' + t + '"/><stop offset="1" stop-color="' + lo + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + lo + '"/><stop offset="1" stop-color="' + hi + '"/></linearGradient></defs>' +
      '<circle cx="66" cy="66" r="62" fill="url(#' + id + 'r)"/>' +
      '<circle cx="66" cy="66" r="51" fill="url(#' + id + 'b)"/>' +
      '<circle cx="66" cy="66" r="48" fill="' + face + '"/>' +
      '<path d="M30 44 A42 42 0 0 1 88 24" fill="none" stroke="#ffffff" stroke-opacity="' + (dark ? 0.12 : 0.5) + '" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="66" y="66" text-anchor="middle" dominant-baseline="central" font-family="material" font-size="52" fill="' + ink + '">' + g(glyph) + '</text>' +
      '</svg>';
  }
  var TIER_NAME = { b: 'Bronze', s: 'Prata', g: 'Ouro' };

  /* ---------- confetti (PROPOSED: 40 pieces, 900 ms, no flashing) ---------- */
  function confetti(originY) {
    var old = document.querySelector('.gx-canvas'); if (old) old.remove();
    if (S.rm) return;
    var cv = el('canvas', 'gx-canvas'); document.body.appendChild(cv);
    var w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr;
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var c = C(), cols = [c.accentPrimary, c.accentWarm, TIER.g, c.success, c.accentCyan];
    var P = []; for (var i = 0; i < 40; i++) P.push({ x: w / 2 + (Math.random() - .5) * 80, y: originY, vx: (Math.random() - .5) * 6, vy: -Math.random() * 6 - 2, w: 4 + Math.random() * 4, h: 6 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .25, c: cols[i % cols.length] });
    var s = performance.now();
    var step = function (now) {
      var t = (now - s) / MS.celebrate; ctx.clearRect(0, 0, w, h); if (t >= 1) { cv.remove(); return; }
      var a = 1 - easeOut(t);
      P.forEach(function (p) { p.vy += .2; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      S.rafs.push(requestAnimationFrame(step));
    };
    S.rafs.push(requestAnimationFrame(step));
  }

  /* ---------- Cravos card (profile) ---------- */
  function profileAnchor() {
    var name = tid('profile-card-name'), edit = tid('profile-edit');
    return name && edit ? climbUntil(name, function (p) { return p.contains(edit); }) : null;
  }
  function cravosCard() {
    var card = el('div', 'gx-card gx-added');
    card.setAttribute('data-gx', 'wallet');
    card.innerHTML =
      '<div class="gx-row gx-between"><span class="gx-t gx-micro">SEUS CRAVOS</span>' +
      '<span class="gx-chip"><span class="gx-t gx-caption">Nível Ramalhete</span></span></div>' +
      '<div class="gx-row"><span class="gx-icon" aria-hidden="true">' + g('florist') + '</span><span class="gx-t gx-figure" data-gx-bal>1.210</span></div>' +
      '<div class="gx-bar" role="progressbar" aria-valuemin="0" aria-valuemax="2500" aria-valuenow="1240" aria-label="Progresso até Jardim"><b data-gx-bar></b></div>' +
      '<div class="gx-row gx-between"><span class="gx-t gx-caption">Ramalhete</span><span class="gx-t gx-caption">1.240 de 2.500 para Jardim</span></div>' +
      '<div class="gx-div"></div>' +
      '<div class="gx-ledger"><span class="gx-t gx-body">Conversa iniciada com Maya <span class="gx-caption">· hoje</span></span><span class="gx-t gx-label gx-pos">+30</span></div>' +
      '<div class="gx-ledger"><span class="gx-t gx-body">Semana completa <span class="gx-caption">· seg</span></span><span class="gx-t gx-label gx-pos">+15</span></div>' +
      '<div class="gx-ledger"><span class="gx-t gx-body">Ajuste: match desfeito <span class="gx-caption">· sáb</span></span><span class="gx-t gx-label gx-neg">−5</span></div>' +
      // gap xs 8 + margin xs 8 = DsSpace.md 16 between the ledger and the actions.
      '<div class="gx-pill" style="margin-top:8px"><span class="gx-t gx-button">Ver extrato</span></div>' +
      '<div class="gx-pill sm disabled" aria-disabled="true"><span class="gx-t gx-button">Trocar Cravos · em breve</span></div>';
    return card;
  }

  var BADGES = {
    faisca: { name: 'Primeira faísca', glyph: 'forum', desc: 'Você e outra pessoa trocaram as primeiras mensagens de verdade.', tiers: [1, 5, 20], unit: 'conversas iniciadas', one: 'conversa iniciada' },
    passo: { name: 'Primeiro passo', glyph: 'chat', desc: 'Você mandou a primeira mensagem em até 24 h depois do match.', tiers: [3, 10, 30], unit: 'primeiras mensagens' },
    vacuo: { name: 'Sem vácuo', glyph: 'history', desc: 'Você responde as pessoas no mesmo dia.', tiers: [10, 50, 200], unit: 'respostas no dia' },
    constancia: { name: 'Constância', glyph: 'event', desc: 'Semana após semana, você aparece.', tiers: [4, 12, 26], unit: 'semanas seguidas' },
    roda: { name: 'Em roda', glyph: 'groups', desc: 'Ativa: você esteve presente em 3 das últimas 4 semanas.', tiers: [1, 3, 6], unit: 'meses mantendo a roda', one: 'mês mantendo a roda' },
    primavera: { name: 'Primavera vermelha', glyph: 'spa', desc: 'Temporada de primavera: conversas novas entre 22 set e 21 dez.', tiers: [3, 6, 12], unit: 'conversas na temporada' },
    papo: { name: 'Papo que rende', glyph: 'favorite', desc: 'Uma conversa seguiu por dias. É assim que começa.', tiers: [1, 5, 15], unit: 'conversas que renderam', one: 'conversa que rendeu' },
    escuta: { name: 'Escuta atenta', glyph: 'verified', desc: 'Ativa: respondeu 80% das mensagens em até 24 h nos últimos 30 dias.', tiers: [5, 10, 20], unit: 'conversas no período' },
    cartao: { name: 'Cartão em dia', glyph: 'edit', desc: 'Sua resposta continua com a sua cara.', tiers: [1, 3, 6], unit: 'respostas atualizadas', one: 'resposta atualizada' }
  };
  var CATALOG = [['faisca', 's'], ['passo', 'g'], ['vacuo', 'b'], ['constancia', 'b'], ['roda', 'b'], ['primavera', 'b'], ['papo', 'b', 'Faltam 1'], ['escuta', 'b', 'Faltam 3'], ['cartao', 'b', 'Faltam 1']];
  function qty(b, n) { return n === 1 && b.one ? '1 ' + b.one : n + ' ' + b.unit; }
  function nextLine(b, tier) { var i = { b: 0, s: 1, g: 2 }[tier]; return i < 2 ? (['Prata', 'Ouro'][i] + ': ' + qty(b, b.tiers[i + 1])) : ('Nível máximo: ' + qty(b, b.tiers[2])); }

  function catalogCard() {
    var card = el('div', 'gx-card gx-added');
    card.setAttribute('data-gx', 'catalog');
    card.innerHTML = '<div class="gx-row gx-between"><span class="gx-t gx-micro">CONQUISTAS</span><span class="gx-t gx-caption">6 de 22 · só você vê</span></div><div class="gx-grid"></div>';
    var grid = card.querySelector('.gx-grid');
    CATALOG.forEach(function (row) {
      var b = BADGES[row[0]], tier = row[1], left = row[2];
      var t = el('button', 'gx-tile' + (left ? ' locked' : ''));
      t.type = 'button';
      t.setAttribute('aria-label', left ? b.name + ', bloqueada, ' + left : b.name + ', ' + TIER_NAME[tier] + '. Rever conquista');
      t.innerHTML = medal(56, tier, b.glyph) + '<span class="gx-t gx-caption" style="color:var(--textPrimary)">' + b.name + '</span><span class="gx-t gx-micro" style="color:var(--textTertiary)">' + (left || TIER_NAME[tier]) + '</span>';
      t.addEventListener('click', function () { if (!left) sheet(b, tier); });
      grid.appendChild(t);
    });
    return card;
  }

  function sheet(b, tier) {
    clearAll();
    var old = document.querySelector('.gx-sheet-wrap'); if (old) old.remove();
    var w = el('div', 'gx-sheet-wrap gx-added');
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', b.name);
    w.innerHTML = '<div class="gx-scrim"></div><div class="gx-sheet"><div class="gx-grab"></div>' +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0;text-align:center">' +
      '<div data-gx-medal>' + medal(120, tier, b.glyph) + '</div>' +
      '<span class="gx-t gx-micro">CONQUISTA</span><span class="gx-t gx-heading">' + b.name + '</span>' +
      '<span class="gx-chip" style="align-self:center;background:' + TIER[tier] + '"><span class="gx-t gx-caption" style="color:#ffffff">' + TIER_NAME[tier] + '</span></span>' +
      '<span class="gx-t gx-body" style="color:var(--textSecondary);max-width:30ch">' + b.desc + '</span>' +
      '<span class="gx-t gx-caption">' + nextLine(b, tier) + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;padding-top:12px"><div class="gx-pill primary" role="button" tabindex="0" data-gx-close><span class="gx-t gx-button">Fechar</span></div></div></div>';
    document.body.appendChild(w);
    var scrim = w.querySelector('.gx-scrim'), sh = w.querySelector('.gx-sheet'), md = w.querySelector('[data-gx-medal]');
    var close = function () { w.remove(); var cv = document.querySelector('.gx-canvas'); if (cv) cv.remove(); };
    scrim.addEventListener('click', close); w.querySelector('[data-gx-close]').addEventListener('click', close);
    // DsSheet enter: scrim fades in, sheet slides up (standard 220 ms, easeOut). Medal as in MatchCelebration (slow 360 ms).
    if (!S.rm) {
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MS.standard, easing: EASE, fill: 'both' });
      sh.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: MS.standard, easing: EASE, fill: 'both' });
      md.animate([{ opacity: 0, transform: 'translateY(-10px) scale(.62)' }, { opacity: 1, transform: 'none' }], { duration: MS.slow, delay: MS.standard, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'both' });
      later(function () { confetti(innerHeight - sh.offsetHeight + 80); }, MS.standard + 120);
    }
  }

  /* The store's own review sheet is drawn by iOS (StoreKit) or Android (Play In-App Review), not by the app.
     It is shown as a labelled placeholder, never as a copy of Apple's or Google's UI. */
  function osSheet() {
    var w = el('div', 'gx-sheet-wrap gx-added'); w.setAttribute('data-gx', 'os-sheet');
    w.innerHTML = '<div class="gx-scrim"></div><div class="gx-sheet" style="margin:0 16px 24px;border-radius:20px;border:1.5px dashed var(--borderStrong);background:var(--surface);gap:8px;align-items:center;text-align:center;padding:20px">' +
      '<span class="gx-t gx-micro" style="color:var(--textTertiary)">ESPAÇO DO SISTEMA</span>' +
      '<span class="gx-t gx-cardTitle">A folha de avaliação da loja abre aqui</span>' +
      '<span class="gx-t gx-caption">Desenhada pelo iOS ou pelo Android, fora do app. O app não recebe a nota e não sabe se a pessoa avaliou.</span>' +
      '<div class="gx-pill sm" role="button" tabindex="0" data-gx-close style="align-self:stretch;margin-top:4px"><span class="gx-t gx-button">Fechar exemplo</span></div></div>';
    document.body.appendChild(w);
    var close = function () { w.remove(); };
    w.querySelector('.gx-scrim').addEventListener('click', close);
    w.querySelector('[data-gx-close]').addEventListener('click', close);
    if (!S.rm) {
      w.querySelector('.gx-scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: MS.standard, easing: EASE, fill: 'both' });
      w.querySelector('.gx-sheet').animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: MS.standard, easing: EASE, fill: 'both' });
    }
  }

  /* ---------- scenes ---------- */
  var scenes = {
    /* Chat (base: atlas 12-chat.history). Earn toast as a DsNotice overlay. */
    toast: {
      build: function () {
        var m1 = tid('chat-message-m1'), me = tid('chat-message-history-me');
        if (!m1 || !me) return;
        var rowM1 = climbUntil(m1, function (p) { return p.contains(me); });
        var rowMe = climbUntil(me, function (p) { return p.contains(m1); });
        var clone = rowMe.cloneNode(true); clone.classList.add('gx-added'); clone.setAttribute('data-gx', 'sent');
        clone.querySelectorAll('[data-testid]').forEach(function (n) { n.removeAttribute('data-testid'); });
        var w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT), n; while ((n = w.nextNode())) { if (n.nodeValue.trim()) { n.nodeValue = 'Fechado. Sábado às 10h?'; break; } }
        clone.style.display = 'none';
        rowM1.parentElement.insertBefore(clone, rowM1.nextSibling);
        var wrap = el('div', 'gx-notice-wrap gx-added');
        wrap.innerHTML = '<div class="gx-card gx-notice" role="status"><div class="tint"></div><div class="ic"><span class="gx-icon" aria-hidden="true">' + g('florist') + '</span></div>' +
          '<div class="content has-close"><span class="gx-t gx-cardTitle">+<span data-gx-amt>30</span> Cravos</span><span class="gx-t gx-body">Conversa iniciada com Maya</span></div>' +
          '<button type="button" class="gx-close" aria-label="Fechar aviso" data-gx-close><span class="gx-icon" aria-hidden="true">' + g('close') + '</span></button></div>';
        wrap.style.display = 'none';
        document.body.appendChild(wrap);
      },
      play: function () {
        var sent = document.querySelector('[data-gx="sent"]'), wrap = document.querySelector('.gx-notice-wrap');
        if (!sent || !wrap) return;
        sent.style.display = 'none'; wrap.style.display = 'none';
        wrap.querySelectorAll('.gx-petal').forEach(function (p) { p.remove(); });
        later(function () { sent.style.display = ''; var sc = scroller(sent); if (sc) sc.scrollTop = sc.scrollHeight; }, S.rm ? 0 : 500);
        later(function () {
          wrap.style.display = '';
          var amt = wrap.querySelector('[data-gx-amt]'), card = wrap.querySelector('.gx-notice');
          if (!S.rm) card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: MS.standard, easing: EASE, fill: 'both' });
          amt.textContent = S.rm ? '30' : '0';
          tween(MS.countUp, function (p) { amt.textContent = fmt(30 * p); });
          if (!S.rm) {
            var ic = wrap.querySelector('.ic'), c = C();
            for (var i = 0; i < 10; i++) {
              var p = el('span', 'gx-petal'); p.style.background = i % 2 ? c.accentPrimary : c.accentWarm; ic.appendChild(p);
              var a = (i * 36 + Math.random() * 14) * Math.PI / 180, d = 20 + Math.random() * 16;
              p.animate([{ opacity: 1, transform: 'translate(0,0) scale(1)' }, { opacity: 0, transform: 'translate(' + Math.cos(a) * d + 'px,' + Math.sin(a) * d + 'px) scale(.4)' }], { duration: 700, delay: 200, easing: EASE, fill: 'both' });
            }
          }
          // DsNotice: no actions, so it auto-dismisses after DS_NOTICE_MIN_VISIBLE_MS (5 s); exit is fast 120 ms, -8 pt.
          // The close button plays the same exit at once.
          var gone = false, exit = function () {
            if (gone) return; gone = true;
            if (S.rm) { wrap.style.display = 'none'; return; }
            card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: MS.fast, easing: EASE, fill: 'both' }).onfinish = function () { wrap.style.display = 'none'; };
          };
          wrap.querySelector('[data-gx-close]').onclick = exit;
          later(exit, 5000);
        }, S.rm ? 50 : 1200);
      }
    },

    /* Matches (base: atlas 11-matches.ready). Weekly streak card above the list. */
    streak: {
      build: function () {
        var row = tid('match-row-lucas_test-user'), other = tid('match-row-maya_test-user');
        if (!row || !other) return;
        var item = climbUntil(row, function (p) { return p.contains(other); });
        var card = el('div', 'gx-card gx-added');
        card.setAttribute('data-gx', 'streak');
        card.innerHTML =
          '<div data-gx-live style="display:flex;flex-direction:column;gap:8px">' +
          '<div class="gx-row gx-between" style="align-items:flex-start">' +
          '<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="gx-t gx-micro">SEQUÊNCIA SEMANAL</span>' +
          '<span class="gx-row" style="gap:6px;align-items:baseline"><span class="gx-t gx-figure" data-gx-n>5</span><span class="gx-t gx-cardTitle">semanas</span></span>' +
          '<span class="gx-t gx-caption" data-gx-msg>Esta semana ainda não contou.</span></div>' +
          '<div class="gx-ring" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--surfaceMuted)" stroke-width="6"/><circle data-gx-ring cx="32" cy="32" r="27" fill="none" stroke="var(--accentPrimary)" stroke-width="6" stroke-linecap="round" stroke-dasharray="169.6" stroke-dashoffset="169.6"/></svg><span class="gx-t gx-label" data-gx-ringn>0/1</span></div></div>' +
          '<div class="gx-weeks" data-gx-weeks aria-label="Últimas 8 semanas"></div>' +
          '<div class="gx-row gx-between"><span class="gx-row" style="gap:4px"><span class="gx-icon" style="font-size:18px;line-height:18px;color:var(--accentCyan)" aria-hidden="true">' + g('bedtime') + '</span><span class="gx-t gx-caption">2 pausas guardadas</span></span><span class="gx-t gx-caption">Próximo marco: 12</span></div></div>' +
          '<div data-gx-rest style="display:none;flex-direction:column;gap:8px"><span class="gx-t gx-micro" style="color:var(--textSecondary)">SEQUÊNCIA SEMANAL</span>' +
          '<span class="gx-t gx-cardTitle">Sua sequência descansou</span><span class="gx-t gx-body" style="color:var(--textSecondary)">Seu recorde continua: 9 semanas. Uma mensagem esta semana começa outra.</span></div>';
        item.parentElement.insertBefore(card, item);
      },
      play: function (opt) {
        var card = document.querySelector('[data-gx="streak"]'); if (!card) return;
        var rest = !!(opt && opt.rested);
        card.querySelector('[data-gx-live]').style.display = rest ? 'none' : 'flex';
        card.querySelector('[data-gx-rest]').style.display = rest ? 'flex' : 'none';
        if (rest) return;
        var st = ['done', 'done', 'pause', 'done', 'done', 'done', 'done', 'now'];
        var wk = card.querySelector('[data-gx-weeks]'); wk.innerHTML = '';
        st.forEach(function (s, i) { var d = el('div', 'gx-wk ' + s, '<i></i><span class="gx-t gx-caption" style="font-size:10px;line-height:12px">S' + (40 + i) + '</span>'); wk.appendChild(d); });
        var ring = card.querySelector('[data-gx-ring]'), n = card.querySelector('[data-gx-n]'), rn = card.querySelector('[data-gx-ringn]'), msg = card.querySelector('[data-gx-msg]');
        ring.style.strokeDashoffset = '169.6'; n.textContent = '5'; rn.textContent = '0/1'; msg.textContent = 'Esta semana ainda não contou.';
        later(function () {
          tween(MS.slow, function (p) { ring.style.strokeDashoffset = String(169.6 * (1 - p)); }, function () {
            rn.textContent = '1/1';
            var now = wk.querySelector('.now'); now.classList.remove('now'); now.classList.add('done');
            if (!S.rm) now.querySelector('i').animate([{ transform: 'scale(.6)' }, { transform: 'none' }], { duration: MS.standard, easing: EASE });
            later(function () { n.textContent = '6'; }, S.rm ? 0 : MS.fast);
            msg.textContent = 'Esta semana já conta: você respondeu a Maya.';
          });
        }, S.rm ? 0 : 700);
      }
    },

    /* Achievement unlock, laid out on the real Match celebration screen (base: atlas 10-match.ready). */
    unlock: {
      build: function () {
        var cel = tid('match-celebration'); if (!cel) return;
        var set = function (from, to) { var n = leafByText(from); if (n) n.textContent = to; return n; };
        S.unlockEls = {
          title: set('É um match!', 'Nova conquista!'),
          sub: set('Você e Maya se curtiram.', 'Você e Maya trocaram as primeiras mensagens de verdade.'),
          name: tid('match-names'),
          detail: leafByText('Maya, 28 · Criativo(a)'),
          label: set('Valores em comum', 'Próximo nível'),
          primary: tid('match-send-message.label'),
          secondary: tid('match-keep-swiping.label')
        };
        if (S.unlockEls.primary) S.unlockEls.primary.textContent = 'Ver conquistas';
        if (S.unlockEls.secondary) S.unlockEls.secondary.textContent = 'Continuar';
        // Shared-values chips become a single "next tier" chip (same chip element, re-labelled).
        var lab = S.unlockEls.label, chipsRow = lab && lab.parentElement && lab.parentElement.children[1];
        if (chipsRow) { var chips = Array.prototype.slice.call(chipsRow.children); chips.slice(1).forEach(function (c) { c.remove(); }); S.unlockEls.chip = chips[0]; }
        // The two portraits make way for the medal, in a frame of the same height.
        var h = cel.getBoundingClientRect().height;
        Array.prototype.forEach.call(cel.children, function (c) { c.style.visibility = 'hidden'; });
        var m = el('div', 'gx-added'); m.setAttribute('data-gx', 'medal');
        m.style.cssText = 'position:absolute;left:0;right:0;top:0;height:' + h + 'px;display:flex;align-items:center;justify-content:center';
        cel.style.position = 'relative'; cel.appendChild(m);
      },
      play: function (opt) {
        var E = S.unlockEls; if (!E) return;
        var id = (opt && opt.id) || 'faisca', tier = (opt && opt.tier) || 'b';
        var b = BADGES[id] || (opt && opt.badge) || BADGES.faisca;
        if (opt && opt.badge) b = { name: opt.badge.name, glyph: opt.badge.glyph || 'trophy', desc: opt.badge.desc, tiers: opt.badge.tiers, unit: opt.badge.unit, one: opt.badge.one };
        if (E.sub) E.sub.textContent = b.desc;
        if (E.name) E.name.textContent = b.name;
        if (E.detail) E.detail.textContent = TIER_NAME[tier] + ' · ' + qty(b, b.tiers[{ b: 0, s: 1, g: 2 }[tier]]);
        if (E.chip) { var t = E.chip.querySelector('div,span') || E.chip; (function deep(n) { while (n.children.length) n = n.children[0]; n.textContent = nextLine(b, tier); })(E.chip); }
        var m = document.querySelector('[data-gx="medal"]');
        m.innerHTML = '<div data-gx-m>' + medal(168, tier, b.glyph) + '</div>';
        var md = m.firstChild;
        if (!S.rm) {
          // Same curve and values as MatchCelebration's heart: 360 ms, Easing.out(cubic), opacity 0→1, y -10→0, scale .62→1.
          md.animate([{ opacity: 0, transform: 'translateY(-10px) scale(.62)' }, { opacity: 1, transform: 'none' }], { duration: MS.slow, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'both' });
          later(function () { var r = m.getBoundingClientRect(); confetti(r.top + r.height / 2); }, MS.slow - 80);
        }
      }
    },

    /* Profile (base: atlas 13-profile.ready). Cravos card after the profile card. */
    wallet: {
      build: function () { var a = profileAnchor(); if (a) a.parentElement.insertBefore(cravosCard(), a.nextSibling); },
      play: function () {
        var c = document.querySelector('[data-gx="wallet"]'); if (!c) return;
        var bal = c.querySelector('[data-gx-bal]'), bar = c.querySelector('[data-gx-bar]');
        bal.textContent = '1.210'; bar.style.width = '0%';
        var sc = scroller(c); if (sc) sc.scrollTop = Math.max(0, c.offsetTop - 140);
        later(function () {
          tween(MS.countUp, function (p) { bal.textContent = fmt(1210 + 30 * p); });
          tween(MS.slow, function (p) { bar.style.width = (p * 1240 / 2500 * 100) + '%'; });
        }, S.rm ? 0 : 400);
      }
    },

    /* Matches (base: atlas 11-matches.ready). Store-rating banner above the rows. No Cravos: store rules forbid it. */
    rate: {
      build: function () {
        var row = tid('match-row-lucas_test-user'), other = tid('match-row-maya_test-user');
        if (!row || !other) return;
        var item = climbUntil(row, function (p) { return p.contains(other); });
        var card = el('div', 'gx-card gx-notice gx-added');
        card.setAttribute('data-gx', 'rate'); card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Avalie o Comradia');
        // The real DsNotice anatomy, inline (no overlay shadow): DsCard row, gap sm 12; tone tint; 24 pt glyph;
        // content column gap xs 8 with cardTitle, body and an actions row (gap xs 8), laid out like
        // ForegroundNotification: DsPillButton size sm, primary first, then ghost.
        card.style.boxShadow = 'none';
        card.innerHTML =
          '<div class="tint"></div><div class="ic"><span class="gx-icon" aria-hidden="true">' + g('star') + '</span></div>' +
          '<div class="content"><span class="gx-t gx-cardTitle">Avalie o Comradia</span>' +
          '<span class="gx-t gx-body">Sua avaliação na loja ajuda outras pessoas a encontrar o app. Leva um minuto.</span>' +
          '<div class="gx-row" style="flex-wrap:wrap">' +
          '<div class="gx-pill sm primary" role="button" tabindex="0" data-gx-rate><span class="gx-t gx-button">Avaliar</span></div>' +
          '<div class="gx-pill sm ghost" role="button" tabindex="0" data-gx-later><span class="gx-t gx-button">Agora não</span></div></div></div>';
        card.style.display = 'none';
        item.parentElement.insertBefore(card, item);
        var out = function (kind) {
          var go = function () {
            card.style.display = 'none';
            parent.postMessage({ gxRate: kind }, '*');
            if (kind === 'rate') osSheet();
          };
          if (S.rm) return go();
          card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: MS.fast, easing: EASE, fill: 'both' }).onfinish = go;
        };
        var bind = function (sel, kind) {
          var b = card.querySelector(sel);
          b.addEventListener('click', function () { out(kind); });
          b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); out(kind); } });
        };
        bind('[data-gx-later]', 'later'); bind('[data-gx-rate]', 'rate');
      },
      play: function () {
        var card = document.querySelector('[data-gx="rate"]'); if (!card) return;
        var s = document.querySelector('[data-gx="os-sheet"]'); if (s) s.remove();
        card.style.display = 'none';
        card.getAnimations().forEach(function (a) { a.cancel(); });
        later(function () {
          card.style.display = '';
          // DsMotionView variant="reveal": opacity 0→1, y 8→0, standard 220 ms, easeOut.
          if (!S.rm) card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: MS.standard, easing: EASE, fill: 'both' });
        }, S.rm ? 0 : 600);
      }
    },

    /* Profile (base: atlas 13-profile.ready). Cravos card + Conquistas card; tap a medal to replay in a DsSheet. */
    cat: {
      build: function () {
        var a = profileAnchor(); if (!a) return;
        var w = cravosCard(); a.parentElement.insertBefore(w, a.nextSibling);
        w.querySelector('[data-gx-bar]').style.width = (1240 / 2500 * 100) + '%'; w.querySelector('[data-gx-bal]').textContent = '1.240';
        a.parentElement.insertBefore(catalogCard(), w.nextSibling);
      },
      play: function () {
        var c = document.querySelector('[data-gx="catalog"]'); if (!c) return;
        var s = document.querySelector('.gx-sheet-wrap'); if (s) s.remove();
        var sc = scroller(c); if (sc) sc.scrollTop = Math.max(0, c.offsetTop - 100);
      }
    }
  };

  var built = null;
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.gx !== 1) return;
    S.scheme = d.scheme === 'dark' ? 'dark' : 'light';
    S.rm = !!d.rm;
    applyTheme();
    if (d.scene && built !== d.scene && scenes[d.scene]) { scenes[d.scene].build(); built = d.scene; }
    if (d.scene && scenes[d.scene]) { clearAll(); scenes[d.scene].play(d.opt || null); }
  });
  translateFixtures();
  applyTheme();
  parent.postMessage({ gxReady: 1 }, '*');
})();
