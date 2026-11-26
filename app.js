/* TT Final Project #26 — Hong Kong street-name translation
   Static site, no build step. Explorer logic + bilingual toggle. */

var CATS = [
  { key: '音譯', en: 'Transliteration', color: '#3A567D' },
  { key: '直譯', en: 'Literal', color: '#1D9695' },
  { key: '意譯', en: 'Free', color: '#C2700A' },
  { key: '混合', en: 'Hybrid', color: '#6D4C9E' }
];
var TYPES = ['Secondary Road', 'Track', 'Main Road', 'Highway', 'Tunnel', 'Restricted Road'];
var TYPE_ZH = {
  'Secondary Road': '次要道路', 'Track': '小徑', 'Main Road': '主要道路',
  'Highway': '高速公路', 'Tunnel': '隧道', 'Restricted Road': '受限制道路'
};

var DATA = null;
var state = { q: '', cat: 'all', checked: 'all', region: 'all', wcTop: 40, treemapBy: 'cat', sort: { key: null, dir: 1 } };
var REGION_ZH = { 'Hong Kong Island': '\u6e2f\u5cf6', 'Kowloon': '\u4e5d\u9f8d', 'New Territories': '\u65b0\u754c' };
var lang = 'en';
try { lang = localStorage.getItem('tt-lang') || 'en'; } catch (e) { lang = 'en'; }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function catOf(key) {
  for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i];
  return CATS[0];
}
function catLabel(c) { return lang === 'zh' ? c.key : c.en; }

/* ---- pure data functions (also used by the node test) ---- */
function filterEntries(entries, st) {
  var q = (st.q || '').trim().toLowerCase();
  return entries.filter(function (e) {
    if (st.cat !== 'all' && e.category !== st.cat) return false;
    if (st.checked !== 'all' && e.human_checked !== st.checked) return false;
    if (st.region !== 'all' && e.region !== st.region) return false;
    if (q && e.zh.toLowerCase().indexOf(q) === -1 &&
        e.en.toLowerCase().indexOf(q) === -1 &&
        e.id.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}
function countByCategory(entries) {
  var out = {};
  CATS.forEach(function (c) { out[c.key] = 0; });
  entries.forEach(function (e) { if (out[e.category] !== undefined) out[e.category]++; });
  return out;
}
function heatmapMatrix(entries) {
  var m = {};
  CATS.forEach(function (c) {
    m[c.key] = {};
    TYPES.forEach(function (t) { m[c.key][t] = 0; });
  });
  entries.forEach(function (e) {
    if (m[e.category] && m[e.category][e.street_type] !== undefined) m[e.category][e.street_type]++;
  });
  return m;
}
var GENERIC_EN = ['ROAD', 'STREET', 'LANE', 'PATH', 'TERRACE', 'DRIVE', 'AVENUE', 'CRESCENT', 'CIRCLE', 'PLACE', 'SQUARE', 'COURT', 'BOULEVARD', 'RUE', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NO', 'DE', 'SECTION', 'TH', 'ND', 'RD', 'ST']; // last four: fragments of ordinals (4TH, 2ND, 3RD, 1ST)
function wordFreq(entries) {
  var freq = {};
  entries.forEach(function (e) {
    e.en.toUpperCase().split(/[^A-Z]+/).forEach(function (w) {
      if (!w || w.length < 2 || GENERIC_EN.indexOf(w) !== -1) return;
      freq[w] = (freq[w] || 0) + 1;
    });
  });
  return Object.keys(freq).map(function (w) { return { word: w, n: freq[w] }; })
    .sort(function (a, b) { return b.n - a.n || (a.word < b.word ? -1 : 1); });
}
function treemapCells(level1, level2, get) {
  var total = 0;
  level1.forEach(function (a) { level2.forEach(function (b) { total += get(a, b); }); });
  if (!total) return [];
  var cells = [], x = 0;
  level1.forEach(function (a) {
    var aTotal = 0;
    level2.forEach(function (b) { aTotal += get(a, b); });
    if (!aTotal) return;
    var w = aTotal / total, y = 0;
    level2.forEach(function (b) {
      var n = get(a, b);
      if (!n) return;
      cells.push({ a: a, b: b, n: n, x: x, y: y, w: w, h: n / aTotal });
      y += n / aTotal;
    });
    x += w;
  });
  return cells;
}
function sortRows(rows) {
  if (!state.sort || !state.sort.key) return rows;
  var k = state.sort.key, d = state.sort.dir;
  return rows.slice().sort(function (a, b) {
    var va = a[k], vb = b[k];
    if (k === 'human_checked') { va = va === 'yes' ? 1 : 0; vb = vb === 'yes' ? 1 : 0; }
    return String(va).localeCompare(String(vb)) * d;
  });
}
function exportCSV(rows) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  var head = ['id', 'zh', 'en', 'category', 'street_type', 'region', 'human_checked', 'confidence'];
  var lines = [head.join(',')];
  rows.forEach(function (e) {
    lines.push(head.map(function (k) {
      var v = String(e[k] === undefined ? '' : e[k]).replace(/"/g, '""');
      return /[",\n]/.test(v) ? '"' + v + '"' : v;
    }).join(','));
  });
  var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tt-street-names-filtered.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
function readUrlState() {
  if (typeof window === 'undefined' || !window.location) return;
  var p = new URLSearchParams(window.location.search);
  if (p.get('q')) state.q = p.get('q');
  var catKeys = CATS.map(function (c) { return c.key; });
  if (p.get('cat') && (p.get('cat') === 'all' || catKeys.indexOf(p.get('cat')) !== -1)) state.cat = p.get('cat');
  if (p.get('checked') === 'yes' || p.get('checked') === 'no') state.checked = p.get('checked');
  if (p.get('region') === 'Hong Kong Island' || p.get('region') === 'Kowloon' || p.get('region') === 'New Territories') state.region = p.get('region');
  var wc = parseInt(p.get('wc'), 10);
  if (wc === 20 || wc === 40 || wc === 60) state.wcTop = wc;
  if (p.get('tm') === 'type') state.treemapBy = 'type';
}
function writeUrlState() {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  var p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.cat !== 'all') p.set('cat', state.cat);
  if (state.checked !== 'all') p.set('checked', state.checked);
  if (state.region !== 'all') p.set('region', state.region);
  if (state.wcTop !== 40) p.set('wc', String(state.wcTop));
  if (state.treemapBy !== 'cat') p.set('tm', state.treemapBy);
  var qs = p.toString();
  window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
}

/* ---- rendering ---- */
function renderTable(rows) {
  var el = document.getElementById('corpusBody');
  if (!el) return;
  rows = sortRows(rows);
  el.innerHTML = rows.map(function (e) {
    var c = catOf(e.category);
    return '<tr><td>' + esc(e.id) + '</td><td>' + esc(e.zh) + '</td><td>' + esc(e.en) +
      '</td><td><span class="cat-tag" style="background:' + c.color + '">' + esc(e.category) +
      ' · ' + esc(c.en) + '</span></td><td>' + esc(e.street_type) +
      '</td><td>' + esc(lang === 'zh' && REGION_ZH[e.region] ? REGION_ZH[e.region] : e.region) +
      '</td><td>' + (e.human_checked === 'yes' ? '✓' : '–') +
      '</td><td>' + esc(e.confidence) + '</td></tr>';
  }).join('');
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.classList.toggle('sorted-asc', !!state.sort && state.sort.key === th.dataset.sort && state.sort.dir === 1);
    th.classList.toggle('sorted-desc', !!state.sort && state.sort.key === th.dataset.sort && state.sort.dir === -1);
  });
}
function renderBar(counts) {
  var el = document.getElementById('barChart');
  if (!el) return;
  var max = 1;
  CATS.forEach(function (c) { max = Math.max(max, counts[c.key] || 0); });
  el.innerHTML = CATS.map(function (c) {
    var n = counts[c.key] || 0;
    var pct = (n / max * 100).toFixed(1);
    return '<div class="bar-row" data-cat="' + c.key + '" role="button" tabindex="0">' +
      '<span class="bar-label">' + esc(catLabel(c)) + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + c.color + '"></span></span>' +
      '<span class="bar-num">' + n + '</span></div>';
  }).join('');
}
function renderDonut(counts) {
  var el = document.getElementById('donutChart');
  if (!el) return;
  var total = 0;
  CATS.forEach(function (c) { total += counts[c.key] || 0; });
  var R = 80, C = 2 * Math.PI * R, offset = 0, parts = '';
  CATS.forEach(function (c) {
    var n = counts[c.key] || 0;
    if (!n || !total) return;
    var len = n / total * C;
    parts += '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + c.color +
      '" stroke-width="30" stroke-dasharray="' + len.toFixed(1) + ' ' + (C - len).toFixed(1) +
      '" stroke-dashoffset="' + (-offset).toFixed(1) + '" data-cat="' + c.key + '" class="donut-seg">' +
      '<title>' + esc(catLabel(c)) + ': ' + n + '</title></circle>';
    offset += len;
  });
  var legend = '<ul class="legend">' + CATS.map(function (c) {
    return '<li data-cat="' + c.key + '"><span class="dot" style="background:' + c.color + '"></span>' +
      esc(catLabel(c)) + ' — ' + (counts[c.key] || 0) +
      (total ? ' (' + ((counts[c.key] || 0) / total * 100).toFixed(1) + '%)' : '') + '</li>';
  }).join('') + '</ul>';
  el.innerHTML = '<div class="donut-centre"><svg viewBox="0 0 200 200" width="180" height="180" style="transform:rotate(-90deg)">' +
    parts + '</svg><div class="donut-total"><b>' + total + '</b><span>' +
    (lang === 'zh' ? '條街名' : 'entries') + '</span></div></div>' + legend;
}
function renderHeatmap(matrix) {
  var el = document.getElementById('heatmap');
  if (!el) return;
  var max = 0;
  CATS.forEach(function (c) { TYPES.forEach(function (t) { max = Math.max(max, matrix[c.key][t]); }); });
  var h = '<table class="heatmap"><thead><tr><th></th>' +
    TYPES.map(function (t) { return '<th>' + esc(lang === 'zh' ? (TYPE_ZH[t] || t) : t) + '</th>'; }).join('') +
    '</tr></thead><tbody>';
  CATS.forEach(function (c) {
    h += '<tr><th>' + esc(catLabel(c)) + '</th>';
    TYPES.forEach(function (t) {
      var n = matrix[c.key][t];
      var a = n ? (0.12 + 0.78 * n / max) : 0;
      h += '<td class="cell" data-cat="' + c.key + '" style="background:rgba(29,150,149,' + a.toFixed(2) + ')">' +
        (n || '–') + '</td>';
    });
    h += '</tr>';
  });
  el.innerHTML = h + '</tbody></table>';
}
function renderTreemap(matrix) {
  var el = document.getElementById('treemap');
  if (!el) return;
  var byType = state.treemapBy === 'type';
  var l1 = byType ? TYPES : CATS.map(function (c) { return c.key; });
  var l2 = byType ? CATS.map(function (c) { return c.key; }) : TYPES;
  var get = byType
    ? function (t, c) { return matrix[c][t] || 0; }
    : function (c, t) { return matrix[c][t] || 0; };
  var cells = treemapCells(l1, l2, get);
  el.innerHTML = cells.map(function (cell) {
    var cat = byType ? cell.b : cell.a;
    var c = catOf(cat);
    var title = (byType ? cell.a : cell.b) + ' \u00b7 ' + (byType ? cell.b : cell.a) + ': ' + cell.n;
    var showLabel = cell.w > 0.09 && cell.h > 0.14;
    return '<div class="tm-cell" role="button" tabindex="0" data-cat="' + esc(cat) + '" title="' + esc(title) + '" style="left:' + (cell.x * 100).toFixed(2) + '%;top:' + (cell.y * 100).toFixed(2) + '%;width:' + (cell.w * 100).toFixed(2) + '%;height:' + (cell.h * 100).toFixed(2) + '%;background:' + c.color + '">' + (showLabel ? '<span>' + esc(cell.b) + ' ' + cell.n + '</span>' : '') + '</div>';
  }).join('');
}
function renderWordCloud(list, topN) {
  var el = document.getElementById('wordCloud');
  if (!el) return;
  var top = list.slice(0, topN);
  if (!top.length) {
    el.innerHTML = '<p class="muted">' + (lang === 'zh' ? '\u6c92\u6709\u7b26\u5408\u7684\u8a5e\u8a9e\u3002' : 'No words to show.') + '</p>';
    return;
  }
  var max = top[0].n, min = top[top.length - 1].n;
  el.innerHTML = top.map(function (w) {
    var size = max > min ? 13 + 22 * (Math.log(w.n) - Math.log(min)) / (Math.log(max) - Math.log(min)) : 24;
    return '<span class="wc-word" role="button" tabindex="0" data-word="' + esc(w.word) + '" style="font-size:' + size.toFixed(0) + 'px" title="' + esc(w.word) + ': ' + w.n + '">' + esc(w.word) + '</span>';
  }).join(' ');
}
var MAP = null, MARKERS = null;
function renderMap(entries) {
  var el = document.getElementById('map');
  if (!el) return;
  if (typeof L === 'undefined') {
    el.innerHTML = '<p class="muted">' + (lang === 'zh' ? '\u5730\u5716\u672a\u80fd\u8f09\u5165\uff08\u9700\u8981\u9023\u63a5 Leaflet \u4f3a\u670d\u5668\uff09\u3002' : 'The map could not load (it needs the Leaflet library).') + '</p>';
    return;
  }
  if (!MAP) {
    MAP = L.map('map').setView([22.32, 114.17], 11);
    var landsd = L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: 'Map data \u00a9 Lands Department, HKSAR Government'
    }).addTo(MAP);
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '\u00a9 OpenStreetMap contributors'
    });
    L.control.layers({ 'Lands Department': landsd, 'OpenStreetMap': osm }).addTo(MAP);
    MARKERS = L.layerGroup().addTo(MAP);
  }
  MARKERS.clearLayers();
  var bounds = [];
  entries.forEach(function (e) {
    if (e.lat === undefined || e.lon === undefined) return;
    var m = L.circleMarker([e.lat, e.lon], {
      radius: 5, color: '#fff', weight: 1, fillColor: catOf(e.category).color, fillOpacity: 0.9
    });
    m.bindPopup('<b>' + esc(e.zh) + '</b><br>' + esc(e.en) + '<br>' + esc(e.id) + ' \u00b7 ' + esc(e.category) + ' \u00b7 ' + esc(e.region));
    m.addTo(MARKERS);
    bounds.push([e.lat, e.lon]);
  });
  if (!renderMap._fitted && bounds.length) {
    MAP.fitBounds(bounds, { padding: [20, 20] });
    renderMap._fitted = true;
  }
}
function renderAll() {
  if (!DATA) return;
  var filtered = filterEntries(DATA, state);
  var counts = countByCategory(filtered);
  renderTreemap(heatmapMatrix(filtered));
  renderWordCloud(wordFreq(filtered), state.wcTop);
  renderMap(filtered);
  var rc = document.getElementById('resultCount');
  if (rc) {
    rc.textContent = lang === 'zh'
      ? '顯示 ' + filtered.length + ' / ' + DATA.length + ' 條'
      : 'Showing ' + filtered.length + ' of ' + DATA.length + ' entries';
  }
  renderTable(filtered);
  renderBar(counts);
  renderDonut(counts);
  renderHeatmap(heatmapMatrix(filtered));
  document.querySelectorAll('.chip[data-cat]').forEach(function (chip) {
    chip.classList.toggle('active', chip.dataset.cat === state.cat);
  });
  writeUrlState();
}
function setCat(key) {
  state.cat = key;
  var sel = document.getElementById('catFilter');
  if (sel) sel.value = key;
  renderAll();
  var ex = document.getElementById('explorer');
  if (ex) ex.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- bilingual toggle ---- */
function applyLang(l, rerender) {
  lang = l;
  try { localStorage.setItem('tt-lang', l); } catch (e) { /* private mode */ }
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-en]').forEach(function (el) {
    el.textContent = l === 'zh' ? el.dataset.zh : el.dataset.en;
  });
  document.querySelectorAll('[data-en-ph]').forEach(function (el) {
    el.placeholder = l === 'zh' ? el.dataset.zhPh : el.dataset.enPh;
  });
  var btn = document.getElementById('langBtn');
  if (btn) btn.textContent = l === 'zh' ? 'English' : '繁體中文';
  if (rerender !== false && DATA) renderAll();
}

/* ---- init ---- */
function bindControls() {
  var q = document.getElementById('searchBox');
  if (q) q.addEventListener('input', function () { state.q = q.value; renderAll(); });
  var sel = document.getElementById('checkedFilter');
  if (sel) sel.addEventListener('change', function () { state.checked = sel.value; renderAll(); });
  var reg = document.getElementById('regionFilter');
  if (reg) reg.addEventListener('change', function () { state.region = reg.value; renderAll(); });
  document.querySelectorAll('.chip[data-cat]').forEach(function (chip) {
    chip.addEventListener('click', function () { setCat(chip.dataset.cat); });
  });
  var clear = document.getElementById('clearBtn');
  if (clear) clear.addEventListener('click', function () {
    state = { q: '', cat: 'all', checked: 'all', region: 'all', wcTop: 40, treemapBy: 'cat', sort: { key: null, dir: 1 } };
    if (q) q.value = '';
    if (sel) sel.value = 'all';
    var reg = document.getElementById('regionFilter');
    if (reg) reg.value = 'all';
    var wc = document.getElementById('wcTop');
    if (wc) wc.value = '40';
    var tm = document.getElementById('tmBy');
    if (tm) tm.value = 'cat';
    renderAll();
  });
  var wc = document.getElementById('wcTop');
  if (wc) wc.addEventListener('change', function () { state.wcTop = parseInt(wc.value, 10) || 40; renderAll(); });
  var tm = document.getElementById('tmBy');
  if (tm) tm.addEventListener('change', function () { state.treemapBy = tm.value === 'type' ? 'type' : 'cat'; renderAll(); });
  var exp = document.getElementById('exportBtn');
  if (exp) exp.addEventListener('click', function () { exportCSV(filterEntries(DATA || [], state)); });
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.sort;
      if (state.sort.key === k) { state.sort.dir = -state.sort.dir; }
      else { state.sort = { key: k, dir: 1 }; }
      renderAll();
    });
  });
  document.addEventListener('click', function (e) {
    var w = e.target.closest ? e.target.closest('.wc-word') : null;
    if (w) {
      state.q = w.dataset.word;
      var q = document.getElementById('searchBox');
      if (q) q.value = w.dataset.word;
      renderAll();
      var ex = document.getElementById('explorer');
      if (ex) ex.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-cat]') : null;
    if (!t) return;
    if (t.classList.contains('bar-row') || t.classList.contains('donut-seg') ||
        t.classList.contains('cell') || t.classList.contains('tm-cell') || t.tagName === 'LI') {
      setCat(t.dataset.cat);
    }
  });
}
function init() {
  var btn = document.getElementById('langBtn');
  if (btn) btn.addEventListener('click', function () { applyLang(lang === 'zh' ? 'en' : 'zh'); });
  readUrlState();
  applyLang(lang, false);
  if (!document.getElementById('explorer')) return;
  bindControls();
  var q = document.getElementById('searchBox');
  if (q) q.value = state.q;
  var sel = document.getElementById('checkedFilter');
  if (sel) sel.value = state.checked;
  var reg = document.getElementById('regionFilter');
  if (reg) reg.value = state.region;
  var wc = document.getElementById('wcTop');
  if (wc) wc.value = String(state.wcTop);
  var tm = document.getElementById('tmBy');
  if (tm) tm.value = state.treemapBy;
  fetch('data/corpus.json').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (json) {
    DATA = json.entries;
    renderAll();
  }).catch(function (err) {
    var box = document.getElementById('loadError');
    if (box) box.style.display = 'block';
    var msg = document.getElementById('loadErrorMsg');
    if (msg) {
      var is404 = err && String(err.message).indexOf('404') !== -1;
      msg.textContent = is404
        ? (lang === 'zh'
          ? 'data/corpus.json 未找到 — 請檢查 repo 內是否有 data/ 文件夾，內含 corpus.json。'
          : 'data/corpus.json was not found — check the repository has a data/ folder containing corpus.json.')
        : (lang === 'zh'
          ? '語料載入失敗，請檢查網絡連線，或稍後再試。'
          : 'The corpus data did not load. Please check your connection and try again.');
    }
  });
}
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATS: CATS, TYPES: TYPES, filterEntries: filterEntries, countByCategory: countByCategory, heatmapMatrix: heatmapMatrix, wordFreq: wordFreq, treemapCells: treemapCells, sortRows: sortRows };
}
