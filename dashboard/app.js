// Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked launch board, an Already trading view of the protocols whose token exists, filters and
// sorting, and a detail sheet for every protocol with the model's own arithmetic recomputed live.
// No network: every byte it shows arrived in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + ' yrs';
    return Math.max(0, Math.round(days)) + ' days';
  }
  function fmtMult(n) { return n === null || n === undefined ? 'n/a' : n.toFixed(2) + 'x'; }

  // The model, one function: the page recomputes every row from the snapshot figures with the same
  // constants main.ts publishes, so the board's numbers can be checked against its code on sight.
  function impliedOf(row) {
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(M.growth_cap, Math.max(M.growth_floor, g));
    var growth = 1 + (g / 100) * M.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    var maturity = M.maturity_base + M.maturity_range * (1 - Math.exp(-Math.max(age, 0) / M.maturity_tau_days));
    var breadth = 1 + M.breadth_weight * Math.min(Math.max((row.chains || []).length - 1, 0), M.breadth_chains);
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growth * maturity * breadth));
  }
  var compByCat = {};
  DATA.calibration.categories.forEach(function (c) { compByCat[c.category] = c; });

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // State lives in the hash, so a filtered view or an open protocol is a link, not a gesture.
  var state = { q: '', cat: 'all', chain: 'all', tier: 'all', tab: 'board', sort: 'rank', dir: 1, p: null };
  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length === 2 && state.hasOwnProperty(kv[0])) state[kv[0]] = decodeURIComponent(kv[1]);
    });
    state.dir = Number(state.dir) || 1;
  }
  function writeHash() {
    var parts = [];
    ['q', 'cat', 'chain', 'tier', 'tab', 'sort'].forEach(function (k) {
      if (state[k] && state[k] !== 'all' && state[k] !== 'board' && state[k] !== 'rank') parts.push(k + '=' + encodeURIComponent(state[k]));
    });
    if (state.dir !== 1) parts.push('dir=' + state.dir);
    if (state.p) parts.push('p=' + encodeURIComponent(state.p));
    history.replaceState(null, '', '#' + parts.join('&'));
  }
  readHash();

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.tier === 'watch' && !r.watchlist) return false;
      if (state.tier === 'early' && r.watchlist) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  var SORTS = {
    rank: function (r) { return r.rank; },
    implied: function (r) { return r.implied_value_usd; },
    tvl: function (r) { return r.tvl_usd; },
    change: function (r) { return r.change_7d === null ? -1e9 : r.change_7d; },
    age: function (r) { return r.age_days === null ? -1 : r.age_days; },
    mult: function (r) { return r.implied_per_tvl; }
  };
  function sorted(list) {
    var f = SORTS[state.sort] || SORTS.rank;
    return list.slice().sort(function (a, b) { return (f(a) - f(b)) * state.dir || a.rank - b.rank; });
  }

  /* ---------- static shell: header, stats, model, controls ---------- */
  function stat(v, k) { return el('div', { class: 'stat' }, el('div', { class: 'v' }, v), el('div', { class: 'k', text: k })); }
  var top = DATA.rows[0];
  var header = el('header', null,
    el('div', { class: 'top' },
      el('div', { class: 'brand' },
        el('div', { class: 'rings', 'aria-hidden': 'true' }),
        el('div', null,
          el('div', { class: 'kicker', text: 'Token launch radar' }),
          el('h1', { text: 'Launches that have not happened yet, ranked by what they would be worth' }))),
      el('div', { class: 'stamp' },
        el('div', null, 'snapshot ', el('b', { text: DATA.as_of })),
        el('div', null, 'model ', el('b', { text: DATA.model_version })),
        el('div', null, 'runs offline, no feed'))),
    el('p', { class: 'lede' },
      'Every protocol in the snapshot that still records no token, ranked by an implied launch value read off the market itself: ' +
      'what trading protocols in the same line of business are worth per dollar of TVL, adjusted for growth, for how long the record has run tokenless, and for chain breadth. ' +
      'The watchlist is the floor, not the ceiling — the board keeps scanning below it. Click any row for its valuation, worked line by line, and the plan to farm it.'),
    el('div', { class: 'stats' },
      stat(String(DATA.protocols_size), 'protocols scanned'),
      stat(String(DATA.pre_token_size), 'record no token'),
      stat(String(DATA.board_size), 'ranked on the board'),
      stat(DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'watchlist covered'),
      stat('', 'top implied launch')),
    el('section', { class: 'model' },
      el('h2', { text: 'The value model — comparables, calibrated by this snapshot' }),
      el('p', null,
        'For each category, take the protocols whose token already trades and read the median of market cap / TVL: that is the multiple the market pays there. ' +
        'Thin categories shrink toward the market-wide median, an evidence cap ties a category to that median until its comparables pile up, and every multiple clamps to 0.05x–3.00x, so no single name can bend the board. ',
        el('span', { class: 'fx', text: 'implied = TVL x category multiple x growth x maturity x breadth' }),
        ' Growth moves with the seven-day TVL change, maturity with the years run with no token, breadth with deployed chains. ' +
        'The page recomputes every row from these constants; open a protocol and the arithmetic is on the sheet, checked against board.json.')));

  header.querySelectorAll('.stat .v')[4].appendChild(el('span', null, fmtUsd(top.implied_value_usd) + ' '));
  header.querySelectorAll('.stat .v')[4].appendChild(el('em', { text: top.name }));

  var search = el('input', { type: 'search', placeholder: 'Search name or slug', value: state.q, 'aria-label': 'Search protocols' });
  search.addEventListener('input', function () { state.q = search.value; writeHash(); renderResults(); });
  function selectFor(key, options, allLabel) {
    var s = el('select', { 'aria-label': allLabel });
    s.appendChild(el('option', { value: 'all', text: allLabel }));
    options.forEach(function (o) { s.appendChild(el('option', { value: o, text: o, selected: state[key] === o ? 'selected' : null })); });
    s.value = state[key];
    s.addEventListener('change', function () { state[key] = s.value; writeHash(); renderResults(); });
    return s;
  }
  var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var chainCount = {};
  DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCount[c] = (chainCount[c] || 0) + 1; }); });
  var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a]; }).slice(0, 24);
  var catSel = selectFor('cat', cats, 'All categories');
  var chainSel = selectFor('chain', chains, 'All chains');
  var tierSel = selectFor('tier', ['watch', 'early'], 'Whole board');
  tierSel.querySelector('option[value="watch"]').textContent = 'Watchlist only';
  tierSel.querySelector('option[value="early"]').textContent = 'Early finds only';
  var tabBoard = el('button', { type: 'button', text: 'Launch board' });
  var tabLive = el('button', { type: 'button', text: 'Already trading' });
  function setTab(t) {
    state.tab = t;
    tabBoard.setAttribute('aria-pressed', t === 'board' ? 'true' : 'false');
    tabLive.setAttribute('aria-pressed', t === 'live' ? 'true' : 'false');
    writeHash(); renderResults();
  }
  tabBoard.addEventListener('click', function () { setTab('board'); });
  tabLive.addEventListener('click', function () { setTab('live'); });
  var count = el('span', { class: 'count' });
  var controls = el('div', { class: 'controls' },
    el('div', { class: 'seg' }, tabBoard, tabLive), search, catSel, chainSel, tierSel, count);
  var wrap = el('div', { class: 'boardwrap' });
  var foot = el('footer', { class: 'foot' },
    el('p', { text: 'Implied value is this board\'s own model claim about what a launch would be worth if the record stayed as it is. It is not a prediction that any protocol will issue a token, and a protocol "records no token" in this snapshot — that is all any board can honestly say.' }),
    el('p', { class: 'src', text: 'Source: ' + DATA.source + ' · as of ' + DATA.as_of + ' · board generated from the sealed snapshot by main.ts (' + DATA.model_version + ')' }));

  var dialog = el('dialog', { id: 'detail', 'aria-label': 'Protocol detail' });
  var sheet = el('div', { class: 'sheet' });
  dialog.appendChild(sheet);
  dialog.addEventListener('close', function () { state.p = null; writeHash(); });

  var shell = el('div', { class: 'shell' }, header, controls, wrap, foot);
  app.appendChild(shell); app.appendChild(dialog);
  app.removeAttribute('aria-busy');
  setTab(state.tab === 'live' ? 'live' : 'board');

  /* ---------- results: board table and live table ---------- */
  function sortHead(key, label, cls) {
    var mark = state.sort === key ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
    return el('th', { class: cls || '' }, el('button', {
      type: 'button', text: label + mark,
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
        writeHash(); renderResults();
      }
    }));
  }
  function boardTable(list) {
    var max = DATA.rows.length > 0 ? DATA.rows[0].implied_value_usd : 1;
    var shown = list.slice(0, 80);
    var t = el('table', null,
      el('thead', null, el('tr', null,
        sortHead('rank', '#'), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'Main chain' }),
        sortHead('tvl', 'TVL', 'r'), sortHead('change', '7 days', 'r'), sortHead('age', 'Tokenless', 'r'),
        sortHead('implied', 'Implied value', 'r'), sortHead('mult', 'per $ TVL', 'r'))),
      el('tbody', null, shown.map(function (r) {
        return el('tr', {
          class: r.rank <= 3 ? 'top3' : '', tabindex: '0', 'data-slug': r.slug,
          onclick: function () { openDetail(r.slug); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
        },
          el('td', { class: 'rank', text: String(r.rank) }),
          el('td', { class: 'who' },
            el('span', { class: 'nm', text: r.name }),
            el('span', { class: 'badge ' + (r.watchlist ? 'watch' : 'early'), text: r.watchlist ? 'WATCHLIST' : 'EARLY' }),
            el('div', { class: 'sl', text: r.slug })),
          el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
          el('td', { class: 'chn', text: (r.chains && r.chains[0]) || '—' }),
          el('td', { class: 'r num', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'r num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
          el('td', { class: 'r num', text: fmtAge(r.age_days) }),
          el('td', { class: 'r' },
            el('span', { class: 'imp', text: fmtUsd(r.implied_value_usd) }),
            el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(2, Math.round((r.implied_value_usd / max) * 100)) + '%' }))),
          el('td', { class: 'r mult', text: fmtMult(r.implied_per_tvl) }));
      })));
    return t;
  }
  function liveTable() {
    return el('table', null,
      el('thead', null, el('tr', null,
        el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'Main chain' }),
        el('th', { class: 'r', text: 'Market cap' }), el('th', { class: 'r', text: 'TVL' }),
        el('th', { class: 'r', text: 'Cap per $ TVL' }), el('th', { class: 'r', text: '7 days' }))),
      el('tbody', null, DATA.live.map(function (r) {
        return el('tr', null,
          el('td', { class: 'who' }, el('span', { class: 'nm', text: r.name }), el('div', { class: 'sl', text: r.slug })),
          el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
          el('td', { class: 'chn', text: (r.chains && r.chains[0]) || '—' }),
          el('td', { class: 'r num', text: fmtUsd(r.mcap_usd) }),
          el('td', { class: 'r num', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'r mult', text: fmtMult(r.per_tvl) }),
          el('td', { class: 'r num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }));
      })));
  }
  function renderResults() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    if (state.tab === 'live') {
      count.textContent = DATA.live.length + ' trading protocols, kept off the board';
      wrap.appendChild(el('div', { class: 'more', text: 'These protocols already have a token: the market has priced them, so the radar shows its own figures and never ranks them. Their category medians are what calibrate the board.' }));
      wrap.appendChild(liveTable());
      return;
    }
    var list = sorted(visibleRows());
    count.textContent = list.length + ' of ' + DATA.board_size + ' protocols';
    if (list.length === 0) {
      wrap.appendChild(el('div', { class: 'empty' },
        el('h2', { text: 'Nothing on the radar matches' }),
        el('p', { text: 'Clear the search or pick another category, chain or tier.' })));
      return;
    }
    wrap.appendChild(boardTable(list));
    if (list.length > 80) wrap.appendChild(el('div', { class: 'more', text: 'Showing the first 80 of ' + list.length + ' rows — filter or search to narrow the board.' }));
  }

  /* ---------- detail sheet ---------- */
  function cell(v, k) { return el('div', { class: 'cell' }, el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })); }
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.p = slug; writeHash();
    var recomputed = impliedOf(row);
    var comp = compByCat[row.category || 'Uncategorised'];
    var livePeers = DATA.live.filter(function (r) { return (r.category || 'Uncategorised') === (row.category || 'Uncategorised'); }).slice(0, 3);
    while (sheet.firstChild) sheet.removeChild(sheet.firstChild);
    sheet.appendChild(el('div', { class: 'head' },
      el('div', null,
        el('div', { class: 'kicker', text: 'Rank #' + row.rank + ' · ' + (row.watchlist ? 'on the watchlist' : 'early find below the floor') }),
        el('h2', { text: row.name }),
        el('p', { class: 'note', text: row.slug + ' · ' + (row.category || 'Uncategorised') + ' · ' + ((row.chains || []).join(', ') || 'no chain recorded') })),
      el('button', { class: 'close', type: 'button', text: 'Close', onclick: function () { dialog.close(); } })));
    sheet.appendChild(el('div', { class: 'grid' },
      cell(fmtUsd(row.implied_value_usd), 'implied launch value'),
      cell(fmtUsd(row.tvl_usd), 'TVL in snapshot'),
      cell(fmtPct(row.change_7d), 'TVL, 7 days'),
      cell(fmtAge(row.age_days), 'run with no token')));
    sheet.appendChild(el('h3', { text: 'How the value is worked' }));
    var math = el('table', { class: 'math' }, el('tbody', null, [
      el('tr', null, el('td', { text: 'TVL, the base the multiple is paid on' }), el('td', { class: 'r', text: fmtUsd(row.tvl_usd) })),
      el('tr', null, el('td', { text: 'Category multiple — ' + (row.category || 'Uncategorised') + (comp ? ', the shrunk median of ' + comp.live_count + ' trading protocols (raw median ' + fmtMult(comp.raw_median) + ')' : ', no live comparables, the market median') }), el('td', { class: 'r', text: 'x ' + row.category_multiple.toFixed(4) })),
      el('tr', null, el('td', { text: 'Growth — seven-day TVL change, weighted and clamped' }), el('td', { class: 'r', text: 'x ' + row.growth_multiplier.toFixed(4) })),
      el('tr', null, el('td', { text: 'Maturity — time run with no token recorded' }), el('td', { class: 'r', text: 'x ' + row.maturity_multiplier.toFixed(4) })),
      el('tr', null, el('td', { text: 'Breadth — chains deployed on' }), el('td', { class: 'r', text: 'x ' + row.breadth_multiplier.toFixed(4) })),
      el('tr', { class: 'total' }, el('td', { text: 'Implied launch value' }), el('td', { class: 'r', text: fmtUsd(row.implied_value_usd) }))
    ]));
    sheet.appendChild(math);
    sheet.appendChild(el('p', { class: 'note', text: 'This page recomputes the row from the snapshot figures as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ' — the same number board.json carries.' : ' — which differs from board.json, so the data would be stale.') + ' An estimate, not a price, and not a promise of a launch.' }));
    if (livePeers.length > 0) {
      sheet.appendChild(el('h3', { text: 'Trading comparables in the same line' }));
      sheet.appendChild(el('div', { class: 'comps' }, livePeers.map(function (r) {
        return el('span', { class: 'comp' }, r.name + ' ', el('span', { class: 'num', text: fmtUsd(r.mcap_usd) + ' cap · ' + fmtMult(r.per_tvl) }));
      })));
    }
    sheet.appendChild(el('h3', { text: 'The farm plan' }));
    sheet.appendChild(el('ol', { class: 'steps' }, row.farm_steps.map(function (s) { return el('li', { text: s }); })));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  renderResults();
  if (state.p) openDetail(state.p);
})();
