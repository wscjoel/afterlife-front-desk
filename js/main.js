/* 《忘川前台》视觉小说引擎 */
(function () {
  'use strict';

  var SAVE_KEY = 'afd_save_v1';
  var QUOTE_KEY = 'afd_quotes_v1';

  var CHAR_NAME = { mio: '澪', nami: '奈美', rei: '玲' };
  // 来访者 → 立绘文件名
  var GUEST_FACE = {
    '佐仓课长': 'guest-kacho',
    '凛凛Rin': 'guest-rin',
    '静江奶奶': 'guest-obaachan',
  };
  var STAT_DEF = [
    { k: 'anx', en: 'ANXIETY', zh: '不安', v: 40 },
    { k: 'ann', en: 'ANNOYANCE', zh: '烦躁', v: 25 },
    { k: 'env', en: 'ENVY', zh: '嫉妒', v: 15 },
    { k: 'gui', en: 'GUILT', zh: '愧疚', v: 30 },
    { k: 'mor', en: 'MORBIDNESS', zh: '丧', v: 50 },
    { k: 'cla', en: 'CLARITY', zh: '清醒', v: 20 },
  ];

  /* ---------- 运行时状态 ---------- */
  var state = {
    ch: 0,
    stats: {},
    nami: 0,
    rei: 0,
    quotes: [],
    frames: [], // 执行栈 [{nodes, idx}]
    typing: false,
    typeTimer: null,
    waitingChoice: false,
    ended: false,
    scene: null, // 当前情节插画
  };

  function defaultStats() {
    var o = {};
    STAT_DEF.forEach(function (s) { o[s.k] = s.v; });
    return o;
  }

  /* ---------- 存档 ---------- */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        ch: state.ch, stats: state.stats, nami: state.nami, rei: state.rei,
      }));
      localStorage.setItem(QUOTE_KEY, JSON.stringify(state.quotes));
    } catch (e) { /* 隐私模式下静默失败 */ }
  }
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      var q = JSON.parse(localStorage.getItem(QUOTE_KEY) || '[]');
      if (q && q.length) state.quotes = q;
      return s;
    } catch (e) { return null; }
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  var el = {};
  function cacheDom() {
    ['title-screen', 'btn-start', 'btn-continue', 'game', 'stage', 'portrait',
     'orb-wrap', 'dialog', 'name-tag', 'text-body', 'next-hint', 'choices',
     'card-overlay', 'card-text', 'chapter-label', 'side-panel', 'stats-list',
     'affinity-list', 'btn-quotes', 'quotes-modal', 'quotes-list', 'btn-quotes-close',
     'btn-copy-all', 'toast', 'btn-panel', 'end-screen', 'end-profile', 'btn-restart',
     'btn-skip', 'orb-canvas', 'panel-orb-canvas', 'btn-title-quotes',
     'scene', 'scene-img',
    ].forEach(function (id) { el[camel(id)] = $(id); });
  }
  function camel(s) { return s.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); }); }

  /* ---------- 涂鸦灵魂球 ---------- */
  function makeOrb(canvas, opts) {
    var ctx = canvas.getContext('2d');
    var W, H, R, lines = [], tick = 0;
    opts = opts || {};
    function resize() {
      W = canvas.width = canvas.offsetWidth * 2;
      H = canvas.height = canvas.offsetHeight * 2;
      R = Math.min(W, H) * 0.42;
    }
    function chord() {
      var a1 = Math.random() * Math.PI * 2;
      var a2 = a1 + 0.6 + Math.random() * Math.PI * 1.4;
      var r1 = R * (0.25 + Math.random() * 0.75);
      var r2 = R * (0.25 + Math.random() * 0.75);
      return {
        x1: W / 2 + Math.cos(a1) * r1, y1: H / 2 + Math.sin(a1) * r1,
        x2: W / 2 + Math.cos(a2) * r2, y2: H / 2 + Math.sin(a2) * r2,
        life: 60 + Math.random() * 200,
      };
    }
    function frame() {
      if (!canvas.offsetParent) { requestAnimationFrame(frame); return; }
      if (W !== canvas.offsetWidth * 2) resize();
      tick++;
      ctx.clearRect(0, 0, W, H);
      if (tick % 3 === 0 && lines.length < (opts.density || 70)) lines.push(chord());
      ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--ink').trim() || '#2b2b26';
      ctx.lineWidth = 2;
      for (var i = lines.length - 1; i >= 0; i--) {
        var L = lines[i];
        L.life--;
        if (L.life <= 0) { lines.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, L.life / 40);
        ctx.beginPath();
        ctx.moveTo(L.x1, L.y1);
        ctx.lineTo(L.x2, L.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    resize();
    frame();
  }

  /* ---------- 面板渲染 ---------- */
  function renderPanel() {
    var html = '';
    STAT_DEF.forEach(function (s) {
      var v = clamp(state.stats[s.k], 0, 100);
      html += '<div class="stat-row"><span class="stat-name">' + s.en +
        '<i>' + s.zh + '</i></span><span class="stat-bar"><span class="stat-fill" style="width:' +
        v + '%"></span></span></div>';
    });
    el.statsList.innerHTML = html;
    el.affinityList.innerHTML =
      affRow('NAMI 奈美', state.nami) + affRow('REI 玲', state.rei);
  }
  function affRow(name, v) {
    var pips = '';
    for (var i = 0; i < 6; i++) pips += '<b class="' + (i < v ? 'on' : '') + '"></b>';
    return '<div class="aff-row"><span>' + name + '</span><span class="pips">' + pips + '</span></div>';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function applyFx(fx) {
    if (!fx) return;
    Object.keys(fx).forEach(function (k) {
      if (k === 'nami') state.nami = clamp(state.nami + fx[k], 0, 6);
      else if (k === 'rei') state.rei = clamp(state.rei + fx[k], 0, 6);
      else if (k in state.stats) state.stats[k] = clamp(state.stats[k] + fx[k], 0, 100);
    });
    renderPanel();
  }

  /* ---------- 金句 ---------- */
  function collectQuote(text, by) {
    var plain = text.replace(/<br\s*\/?>/g, ' ').replace(/[（()）]/g, '');
    if (state.quotes.some(function (q) { return q.t === plain; })) return;
    state.quotes.push({ t: plain, by: by || '' });
    save(); // 静默收录，不打断阅读
  }
  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }
  function renderQuotes() {
    if (!state.quotes.length) {
      el.quotesList.innerHTML = '<div class="quote-empty">尚未收录。<br>金句会在剧情中闪光时自动入册。</div>';
      return;
    }
    el.quotesList.innerHTML = state.quotes.map(function (q, i) {
      return '<div class="quote-item"><p>「' + q.t + '」</p><div class="quote-foot"><span>—— ' +
        (q.by || '忘川前台') + '</span><button class="copy-one" data-i="' + i + '">复制</button></div></div>';
    }).join('');
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制，去发圈吧'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制，去发圈吧'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  /* ---------- 执行流 ---------- */
  function startChapter(idx) {
    var ch = STORY.chapters[idx];
    if (!ch) { showEnd(); return; }
    state.ch = idx;
    state.frames = [{ nodes: ch.nodes, idx: 0 }];
    setScene(null);
    save();
    el.chapterLabel.textContent = 'CH.' + ch.no + ' — ' + ch.en + ' ｜ ' + ch.title;
    showCard(ch.title + '<br><span class="card-en">' + ch.en + '</span>', advance);
  }

  function nextNode() {
    while (state.frames.length) {
      var f = state.frames[state.frames.length - 1];
      if (f.idx >= f.nodes.length) { state.frames.pop(); continue; }
      return f.nodes[f.idx++];
    }
    return null;
  }

  function advance() {
    if (state.ended || state.waitingChoice) return;
    if (state.typing) { finishTyping(); return; }
    var node = nextNode();
    if (!node) {
      var next = state.ch + 1;
      if (next < STORY.chapters.length) startChapter(next);
      else showEnd();
      return;
    }
    runNode(node);
  }

  function runNode(node) {
    if (node.card !== undefined) { showCard(node.card, null); return; }
    if (node.choice) { showChoices(node.choice); return; }
    if (node.branch) {
      var key = state.nami > state.rei ? 'nami' : (state.rei > state.nami ? 'rei' : 'else');
      var picked = null, fallback = null;
      node.branch.forEach(function (b) {
        if (b.cond === key) picked = b;
        if (b.cond === 'else') fallback = b;
      });
      var br = picked || fallback || node.branch[0];
      state.frames.push({ nodes: br.nodes, idx: 0 });
      advance();
      return;
    }
    applyFx(node.fx);
    showLine(node);
  }

  /* ---------- 情节场景插画 ---------- */
  function setScene(name) {
    state.scene = name || null;
    if (state.scene) {
      el.sceneImg.src = 'assets/img/' + state.scene + '.png';
      el.scene.classList.add('show');
    } else {
      el.scene.classList.remove('show');
    }
  }
  // 前景是否有人物，决定场景图是否退为暗背景
  function sceneDim(hasForeground) {
    el.scene.classList.toggle('dim', !!hasForeground);
  }

  /* ---------- 台词展示 ---------- */
  var fullText = '', typeIdx = 0, pendingQuote = null;

  function showLine(node) {
    hideCard();
    // pic: 'xxx' 切换情节插画 / pic: null 显式清除
    if ('pic' in node) setScene(node.pic);

    var sp = node.s;
    var isSys = sp === 'sys';
    var isNarr = sp === 'narr';
    var isGuest = sp === 'guest';
    var name = isGuest ? (node.name || '来访者') : (CHAR_NAME[sp] || '');
    var face = isGuest ? GUEST_FACE[node.name] : null;

    // 立绘 / 来访者 / 灵魂球
    el.portrait.className = 'portrait';
    var hasForeground = false;
    if (sp === 'mio' || sp === 'nami' || sp === 'rei') {
      el.portrait.style.backgroundImage = 'url(assets/img/' + sp + '.png)';
      el.portrait.classList.add('show', 'p-' + sp);
      el.orbWrap.classList.remove('show');
      hasForeground = true;
    } else if (isGuest && face) {
      el.portrait.style.backgroundImage = 'url(assets/img/' + face + '.png)';
      el.portrait.classList.add('show', 'p-guest');
      el.orbWrap.classList.remove('show');
      hasForeground = true;
    } else if (isGuest) {
      el.portrait.classList.remove('show');
      el.portrait.style.backgroundImage = '';
      el.orbWrap.classList.add('show');
      hasForeground = true;
    } else {
      // 旁白 / 系统：让位给场景插画，全幅展示
      el.portrait.classList.remove('show');
      el.portrait.style.backgroundImage = '';
      el.orbWrap.classList.remove('show');
    }
    sceneDim(hasForeground);

    // 名牌
    if (name) {
      el.nameTag.style.display = '';
      el.nameTag.textContent = name;
      el.nameTag.className = 'name-tag tag-' + (isGuest ? 'guest' : sp);
    } else {
      el.nameTag.style.display = 'none';
    }

    el.dialog.className = 'dialog' + (isSys ? ' sys' : '') + (isNarr ? ' narr' : '');
    fullText = node.t;
    pendingQuote = node.q ? { t: node.t, by: name || '忘川前台' } : null;
    typeIdx = 0;
    el.textBody.innerHTML = '';
    el.nextHint.classList.remove('show');
    state.typing = true;
    var speed = isSys ? 8 : 26;
    clearInterval(state.typeTimer);
    state.typeTimer = setInterval(function () {
      typeIdx++;
      if (typeIdx >= fullText.length) { finishTyping(); return; }
      el.textBody.textContent = fullText.slice(0, typeIdx);
    }, speed);
  }

  function finishTyping() {
    clearInterval(state.typeTimer);
    state.typing = false;
    el.textBody.textContent = fullText;
    el.nextHint.classList.add('show');
    if (pendingQuote) {
      collectQuote(pendingQuote.t, pendingQuote.by);
      pendingQuote = null;
    }
  }

  /* ---------- 选项 ---------- */
  function showChoices(list) {
    state.waitingChoice = true;
    el.choices.innerHTML = '';
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'choice-btn';
      b.innerHTML = c.t;
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        state.waitingChoice = false;
        el.choices.classList.remove('show');
        applyFx(c.fx);
        if (c.reply && c.reply.length) state.frames.push({ nodes: c.reply, idx: 0 });
        advance();
      });
      el.choices.appendChild(b);
    });
    el.choices.classList.add('show');
  }

  /* ---------- 黑屏卡 ---------- */
  var cardShown = false;
  function showCard(html, cb) {
    cardShown = true;
    el.cardText.innerHTML = html;
    el.cardOverlay.classList.add('show');
    el.cardOverlay.onclick = function (ev) {
      ev.stopPropagation();
      hideCard();
      if (cb) cb(); else advance();
    };
  }
  function hideCard() {
    if (!cardShown) return;
    cardShown = false;
    el.cardOverlay.classList.remove('show');
    el.cardOverlay.onclick = null;
  }

  /* ---------- 结局 ---------- */
  function verdict() {
    var s = state.stats;
    if (state.nami > state.rei) return '「转正型灵魂」——嘴上说丧，手里接单。彼岸前台因你多了一盏不灭的灯。';
    if (state.rei > state.nami) return '「半月型灵魂」——只亮一半，刚好够照亮身边的人。这不是缺陷，是节能。';
    if (s.cla >= 40) return '「清醒型灵魂」——看破不说破，说破也温柔。下辈子记得先学会要，再学会让。';
    return '「待机型灵魂」——执念已签收，行李已清空。请慢走，欢迎下次光临人间。';
  }
  function showEnd() {
    state.ended = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    var s = state.stats;
    var rows = STAT_DEF.map(function (d) {
      return '<div class="end-stat"><span>' + d.en + ' ' + d.zh + '</span><b>' + s[d.k] + '</b></div>';
    }).join('');
    el.endProfile.innerHTML =
      '<div class="end-verdict">' + verdict() + '</div>' +
      '<div class="end-stats">' + rows + '</div>' +
      '<div class="end-note">本周目收录金句 ' + state.quotes.length + ' 条 —— 打开《亡语集》一键复制，朋友圈装逼自由。</div>';
    el.game.classList.add('hidden');
    el.endScreen.classList.remove('hidden');
  }

  /* ---------- 启动 ---------- */
  function startGame(fromSave) {
    state.ended = false;
    if (fromSave) {
      var s = loadSave();
      state.stats = (s && s.stats) || defaultStats();
      state.nami = (s && s.nami) || 0;
      state.rei = (s && s.rei) || 0;
      state.ch = (s && s.ch) || 0;
    } else {
      state.stats = defaultStats();
      state.nami = 0; state.rei = 0; state.ch = 0;
    }
    renderPanel();
    el.titleScreen.classList.add('hidden');
    el.endScreen.classList.add('hidden');
    el.game.classList.remove('hidden');
    startChapter(state.ch);
  }

  function init() {
    cacheDom();
    makeOrb(el.orbCanvas, { density: 80 });
    makeOrb(el.panelOrbCanvas, { density: 40 });

    var s = loadSave();
    if (s && s.ch > 0) el.btnContinue.classList.remove('hidden');

    el.btnStart.addEventListener('click', function () { startGame(false); });
    el.btnContinue.addEventListener('click', function () { startGame(true); });
    el.btnRestart.addEventListener('click', function () {
      el.endScreen.classList.add('hidden');
      el.titleScreen.classList.remove('hidden');
    });

    el.stage.addEventListener('click', advance);
    el.dialog.addEventListener('click', function (ev) { ev.stopPropagation(); advance(); });
    document.addEventListener('keydown', function (ev) {
      if (el.game.classList.contains('hidden')) return;
      if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); advance(); }
    });

    el.btnSkip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (state.typing) finishTyping(); else advance();
    });

    function openQuotes(ev) {
      if (ev) ev.stopPropagation();
      renderQuotes();
      el.quotesModal.classList.add('show');
    }
    el.btnQuotes.addEventListener('click', openQuotes);
    el.btnTitleQuotes.addEventListener('click', openQuotes);
    el.btnQuotesClose.addEventListener('click', function () { el.quotesModal.classList.remove('show'); });
    el.quotesModal.addEventListener('click', function (ev) {
      if (ev.target === el.quotesModal) el.quotesModal.classList.remove('show');
      var btn = ev.target.closest('.copy-one');
      if (btn) {
        var q = state.quotes[+btn.dataset.i];
        copyText('「' + q.t + '」—— 《忘川前台》');
      }
    });
    el.btnCopyAll.addEventListener('click', function () {
      var all = state.quotes.map(function (q) { return '「' + q.t + '」'; }).join('\n');
      copyText(all + '\n—— 《忘川前台》AFTERLIFE FRONT DESK');
    });

    el.btnPanel.addEventListener('click', function (ev) {
      ev.stopPropagation();
      el.sidePanel.classList.toggle('open');
    });

    state.stats = defaultStats();
    renderPanel();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
