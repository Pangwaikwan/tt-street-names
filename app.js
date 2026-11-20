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
var state = { q: '', cat: 'all', checked: 'all' };
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

/* ---- rendering ---- */
function renderTable(rows) {
  var el = document.getElementById('corpusBody');
  if (!el) return;
  el.innerHTML = rows.map(function (e) {
    var c = catOf(e.category);
    return '<tr><td>' + esc(e.id) + '</td><td>' + esc(e.zh) + '</td><td>' + esc(e.en) +
      '</td><td><span class="cat-tag" style="background:' + c.color + '">' + esc(e.category) +
      ' · ' + esc(c.en) + '</span></td><td>' + esc(e.street_type) +
      '</td><td>' + (e.human_checked === 'yes' ? '✓' : '–') +
      '</td><td>' + esc(e.confidence) + '</td></tr>';
  }).join('');
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
function renderAll() {
  if (!DATA) return;
  var filtered = filterEntries(DATA, state);
  var counts = countByCategory(filtered);
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
  document.querySelectorAll('.chip[data-cat]').forEach(function (chip) {
    chip.addEventListener('click', function () { setCat(chip.dataset.cat); });
  });
  var clear = document.getElementById('clearBtn');
  if (clear) clear.addEventListener('click', function () {
    state = { q: '', cat: 'all', checked: 'all' };
    if (q) q.value = '';
    if (sel) sel.value = 'all';
    renderAll();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-cat]') : null;
    if (!t) return;
    if (t.classList.contains('bar-row') || t.classList.contains('donut-seg') ||
        t.classList.contains('cell') || t.tagName === 'LI') {
      setCat(t.dataset.cat);
    }
  });
}
function init() {
  var btn = document.getElementById('langBtn');
  if (btn) btn.addEventListener('click', function () { applyLang(lang === 'zh' ? 'en' : 'zh'); });
  applyLang(lang, false);
  if (!document.getElementById('explorer')) return;
  bindControls();
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
  module.exports = { CATS: CATS, TYPES: TYPES, filterEntries: filterEntries, countByCategory: countByCategory, heatmapMatrix: heatmapMatrix };
}
