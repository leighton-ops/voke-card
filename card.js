/* Voke search card. Renders a slash-menu-style skill picker inside a chat widget.
   Usage: Voke.mount(element, "initial query")
   Reads the library from window.VOKE_LIBRARY (library.js), ordered most popular first.
   Recently run skills (kept in this browser when storage is available) are listed first. */
(function () {
  var ROW = 34, VISIBLE = 8.5, RECENT_KEY = 'voke-recent', RECENT_MAX = 10;
  var CSS = [
    '.vk{background:var(--surface-3);border:1px solid var(--border-strong);border-radius:12px;padding:6px;width:272px;margin:8px 0 16px;font-size:14px;line-height:20px;box-sizing:border-box}',
    '.vk-s{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-bottom:0.5px solid var(--border);margin-bottom:4px}',
    '.vk-s>i{font-size:16px;color:var(--text-secondary)}',
    '.vk-f{position:relative;flex:1;height:20px}',
    '.vk-g{position:absolute;inset:0;white-space:pre;color:var(--text-muted);pointer-events:none;overflow:hidden}',
    '.vk-q{position:absolute;inset:0;width:100%;border:none!important;background:none!important;box-shadow:none!important;padding:0!important;margin:0;height:auto!important;font:inherit;font-size:14px!important;line-height:20px;color:var(--text-primary);outline:none}',
    '.vk-q::placeholder{color:var(--text-muted);opacity:1}',
    '.vk-c{position:absolute;top:1px;left:0;width:1px;height:18px;background:var(--text-primary);pointer-events:none;animation:vk-blink 1.06s step-end infinite}',
    '.vk.vk-on .vk-c{display:none}',
    '@keyframes vk-blink{50%{opacity:0}}',
    '.vk-w{position:relative}',
    '.vk-l{max-height:' + Math.round(ROW * VISIBLE) + 'px;overflow-y:auto;scrollbar-width:none}',
    '.vk-l::-webkit-scrollbar{display:none}',
    '.vk-fade{position:absolute;left:0;right:0;bottom:0;height:44px;pointer-events:none;background:linear-gradient(to bottom,transparent,var(--surface-3));transition:opacity .15s}',
    '.vk-w.vk-end .vk-fade{opacity:0}',
    '.vk-r{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:8px;cursor:pointer;color:var(--text-primary)}',
    '.vk-r.on{background:color-mix(in srgb,var(--text-primary) 8%,transparent)}',
    '.vk-e{flex-shrink:0;font-size:15px;line-height:1;color:var(--text-muted);display:none}',
    '.vk-r.on .vk-e{display:block}',
    '.vk-r>i{font-size:16px;color:var(--text-secondary);flex-shrink:0}',
    '.vk-r>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vk-i{flex-shrink:0;font-size:15px;line-height:1;color:var(--text-muted);cursor:default}',
    '.vk-i:hover{color:var(--text-secondary)}',
    '.vk-d{font-size:12px;line-height:17px;color:var(--text-secondary);margin:4px 10px 8px 36px}',
    '.vk-m{font-size:12px;color:var(--text-muted);margin:8px 10px}',
    '.vk-k{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px}',
    '.vk-k>b{display:block;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--border) 25%,var(--border-strong) 50%,var(--border) 75%);background-size:200% 100%;animation:vk-sh 1.2s ease-in-out infinite}',
    '.vk-k>b:first-child{width:16px;height:16px;border-radius:4px;flex-shrink:0}',
    '@keyframes vk-sh{from{background-position:100% 0}to{background-position:-100% 0}}'
  ].join('');
  // Library index is loaded separately so this file can be pinned to a commit and cached forever,
  // while library.js (regenerated on every skill change) stays on @main.
  var LIB_URL = 'https://cdn.jsdelivr.net/gh/leighton-ops/voke-card@main/library.js';
  var libWaiters = [], libDone = !!window.VOKE_LIBRARY;
  // Start the library request the moment this file runs, before mount, so the two downloads overlap.
  function loadLib(cb) {
    if (libDone) return cb();
    libWaiters.push(cb);
    if (libWaiters.length > 1) return;
    var s = document.createElement('script');
    s.src = LIB_URL; s.async = true;
    s.onload = s.onerror = function () { libDone = true; libWaiters.splice(0).forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }
  loadLib(function () {});

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function slug(v) { return v.toLowerCase().replace(/^[@#*]/, '').trim().replace(/\s+/g, '-'); }
  function send(t) { if (typeof sendPrompt === 'function') sendPrompt(t); }
  function recents() {
    try { var r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; }
  }
  function remember(name) {
    try {
      var r = recents().filter(function (n) { return n !== name; });
      r.unshift(name);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, RECENT_MAX)));
    } catch (e) {}
  }

  function mount(root, query) {
    if (!document.getElementById('vk-css')) {
      var st = el('style'); st.id = 'vk-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var lib = (window.VOKE_LIBRARY || []).slice();
    var loading = !window.VOKE_LIBRARY;
    var sel = 0, mouseMoved = false;
    // Carry over anything typed into the inline shell before this script arrived.
    var pre = root.querySelector('input');
    if (pre && pre.value) query = pre.value;

    // Recent first, then the rest in popularity order.
    function ordered() {
      var rec = recents(), seen = {}, out = [];
      rec.forEach(function (n) {
        for (var i = 0; i < lib.length; i++) if (lib[i].n === n && !seen[n]) { out.push(lib[i]); seen[n] = 1; }
      });
      lib.forEach(function (k) { if (!seen[k.n]) out.push(k); });
      return out;
    }

    var card = el('div', 'vk');
    var bar = el('div', 'vk-s', '<i class="ti ti-search" aria-hidden="true"></i>');
    var field = el('div', 'vk-f');
    var ghost = el('div', 'vk-g');
    var q = el('input', 'vk-q');
    q.placeholder = 'Search Voke';
    q.autocomplete = 'off'; q.spellcheck = false; q.autofocus = true;
    q.setAttribute('aria-label', 'Search Voke skills');
    q.value = query || '';
    var caret = el('div', 'vk-c');
    field.appendChild(ghost); field.appendChild(q); field.appendChild(caret); bar.appendChild(field);
    var wrap = el('div', 'vk-w');
    var list = el('div', 'vk-l');
    var fade = el('div', 'vk-fade');
    wrap.appendChild(list); wrap.appendChild(fade);
    card.appendChild(bar); card.appendChild(wrap);
    root.innerHTML = ''; root.appendChild(card);

    var ctx = document.createElement('canvas').getContext('2d');
    function place() {
      try { ctx.font = getComputedStyle(q).font; caret.style.left = Math.min(ctx.measureText(q.value).width, field.clientWidth - 1) + 'px'; } catch (e) {}
    }
    function edge() { wrap.classList.toggle('vk-end', list.scrollTop + list.clientHeight >= list.scrollHeight - 2); }
    // Scroll events only schedule the end-of-list check; it reads layout once per frame at most.
    var edgeRaf = 0;
    list.addEventListener('scroll', function () {
      if (!edgeRaf) edgeRaf = requestAnimationFrame(function () { edgeRaf = 0; edge(); });
    }, { passive: true });
    q.addEventListener('focus', function () { card.classList.add('vk-on'); });
    q.addEventListener('blur', function () { card.classList.remove('vk-on'); place(); });

    function matches() {
      var base = ordered();
      var v = q.value.toLowerCase().replace(/^[@#*]/, '').trim();
      if (!v) return base;
      var words = v.split(/\s+/), s = slug(v);
      return base.map(function (k, idx) {
        var n = k.n.indexOf(s) === 0 ? 10 : 0;
        var hay = (k.n + ' ' + k.t + ' ' + k.d + ' ' + (k.k || '')).toLowerCase();
        words.forEach(function (w) {
          if (k.n.split('-').some(function (p) { return p.indexOf(w) === 0; })) n += 3;
          else if (hay.indexOf(w) > -1) n += 1;
        });
        return [k, n, idx];
      }).filter(function (x) { return x[1] > 0; })
        .sort(function (a, b) { return b[1] - a[1] || a[2] - b[2]; })
        .map(function (x) { return x[0]; });
    }

    function complete() {
      var v = q.value, s = slug(v), hit = null, base = ordered();
      if (v) for (var i = 0; i < base.length; i++) if (base[i].n.indexOf(s) === 0) { hit = base[i]; break; }
      ghost.textContent = hit && hit.n.length > s.length ? v + hit.n.slice(s.length) : '';
    }

    function highlight(i, scroll) {
      sel = i;
      var rows = list.querySelectorAll('.vk-r');
      rows.forEach(function (x, k) { x.classList.toggle('on', k === i); });
      if (scroll && rows[i]) {
        var r = rows[i], top = r.offsetTop, bottom = top + r.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      }
    }

    function row(k, i) {
      var r = el('div', 'vk-r' + (i === sel ? ' on' : ''), '<i class="ti ti-script" aria-hidden="true"></i><span></span>');
      r.querySelector('span').textContent = k.n;
      r.appendChild(el('i', 'ti ti-corner-down-left vk-e', null)).setAttribute('aria-hidden', 'true');
      r.onmouseenter = function () { if (mouseMoved) highlight(i, false); };
      r.onmousemove = function () { mouseMoved = true; if (sel !== i) highlight(i, false); };
      r.onclick = function () { remember(k.n); send('/voke run ' + k.n); };
      list.appendChild(r);
      if (k.d) {
        var b = el('b', 'vk-i', '<i class="ti ti-info-circle" aria-hidden="true"></i>');
        b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'About ' + k.n);
        var p = el('p', 'vk-d'); p.textContent = k.d; p.style.display = 'none';
        var pinned = false;
        b.onmouseenter = function () { p.style.display = 'block'; edge(); };
        b.onmouseleave = function () { if (!pinned) { p.style.display = 'none'; edge(); } };
        b.onclick = function (e) { e.stopPropagation(); pinned = !pinned; p.style.display = pinned ? 'block' : 'none'; edge(); };
        r.appendChild(b); list.appendChild(p);
      }
    }

    function draw() {
      sel = 0;
      complete();
      list.innerHTML = '';
      list.scrollTop = 0;
      var shown = matches();
      if (loading) {
        [62, 48, 70, 55, 66, 44, 58, 51, 64].forEach(function (w) {
          list.appendChild(el('div', 'vk-k', '<b></b><b style="width:' + w + '%"></b>'));
        });
      } else if (!lib.length) {
        var e1 = el('p', 'vk-m'); e1.textContent = 'Library didn’t load. Press enter to search Voke.'; list.appendChild(e1);
      } else if (!shown.length) {
        var e2 = el('p', 'vk-m'); e2.textContent = 'No match. Press enter to ask Voke.'; list.appendChild(e2);
      }
      shown.forEach(row);
      edge();
    }

    q.addEventListener('input', draw);
    function onKey(e) {
      var rows = list.querySelectorAll('.vk-r'), n = rows.length;
      var atEnd = q.selectionStart === q.value.length;
      if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghost.textContent && atEnd) {
        e.preventDefault(); q.value = ghost.textContent; draw();
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) {
        // Scrolling moves rows under a resting pointer; don't let that steal the selection.
        e.preventDefault(); mouseMoved = false;
        highlight(e.key === 'ArrowDown' ? (sel + 1) % n : (sel - 1 + n) % n, true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var typed = q.value.trim();
        if (rows[sel]) rows[sel].click();
        else if (typed) send('/voke find ' + typed);
      }
    }
    q.addEventListener('keydown', onKey);
    document.addEventListener('keydown', function (e) {
      if (e.target === q || e.defaultPrevented) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') { onKey(e); grab(); }
    });

    draw(); place();
    if (loading) loadLib(function () { lib = (window.VOKE_LIBRARY || []).slice(); loading = false; draw(); });
    function grab() {
      try { window.focus(); } catch (e) {}
      try { q.focus({ preventScroll: true }); q.setSelectionRange(q.value.length, q.value.length); } catch (e) {}
    }
    grab();
    [50, 250, 600, 1200].forEach(function (t) { setTimeout(function () { if (document.activeElement !== q) grab(); }, t); });
    window.addEventListener('focus', grab);
    card.addEventListener('mousedown', function (e) {
      if (!e.target.closest('.vk-r') && e.target !== q) { e.preventDefault(); grab(); }
    });
  }

  window.Voke = { mount: mount };
  // Auto-mount: one script tag renders the card on its own, replacing the inline shell if present.
  var host = document.getElementById('voke');
  if (!host) { host = document.createElement('div'); host.id = 'voke'; (document.body || document.documentElement).appendChild(host); }
  if (!host.querySelector('.vk')) mount(host, host.getAttribute('data-q') || '');
})();
