/* Ledger — 本地离线美股交易记录
   数据源单一：trades 流水。持仓 / 已实现盈亏 / 统计全部由流水按 FIFO 实时推导。 */
'use strict';

const VERSION = '1.6.0';
const EPS = 1e-9;

/* ============================== IndexedDB ============================== */
const DB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('ledger', 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('trades')) db.createObjectStore('trades', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('prices')) db.createObjectStore('prices', { keyPath: 'symbol' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    all: (s) => tx(s, 'readonly', (o) => o.getAll()),
    get: (s, k) => tx(s, 'readonly', (o) => o.get(k)),
    put: (s, v) => tx(s, 'readwrite', (o) => o.put(v)),
    del: (s, k) => tx(s, 'readwrite', (o) => o.delete(k)),
    clear: (s) => tx(s, 'readwrite', (o) => o.clear()),
    bulk: (s, arr) => tx(s, 'readwrite', (o) => { arr.forEach((v) => o.put(v)); }),
  };
})();

/* ============================== state ============================== */
const S = { trades: [], prices: {}, config: { apiKey: '', autoOnOpen: false, lastRefreshAt: 0, hotOrder: [], theme: 'system' }, view: 'overview', editId: null, editSymbol: null, side: 'buy' };

async function load() {
  const [trades, prices, cfg] = await Promise.all([DB.all('trades'), DB.all('prices'), DB.get('settings', 'config')]);
  S.trades = trades.sort(cmpTrade);
  S.prices = {};
  prices.forEach((p) => { S.prices[p.symbol] = p; });
  if (cfg) S.config = { apiKey: '', autoOnOpen: false, lastRefreshAt: 0, hotOrder: [], theme: 'system', ...cfg };
}
const saveConfig = () => DB.put('settings', { id: 'config', ...S.config });

/* ============================== 主题：跟随系统 / 浅色 / 深色 ============================== */
const THEME_COLOR = { dark: '#0b0d12', light: '#ffffff' };
function applyTheme() {
  const t = S.config.theme; // 'system' | 'light' | 'dark'
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('ledger-theme', t); } catch (e) {}
  } else {
    root.removeAttribute('data-theme');
    try { localStorage.removeItem('ledger-theme'); } catch (e) {}
  }
  const sysLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const effective = t === 'light' ? 'light' : t === 'dark' ? 'dark' : (sysLight ? 'light' : 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[effective]);
}
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (S.config.theme === 'system') applyTheme();
  });
}

const cmpTrade = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);

/* ============================== format ============================== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const money = (n, sign) => {
  const v = Math.abs(n);
  const s = '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!sign) return (n < 0 ? '-' : '') + s;
  return (n > EPS ? '+' : n < -EPS ? '-' : '') + s;
};
const pct = (n, sign) => {
  if (!isFinite(n)) return '—';
  const s = (Math.abs(n) * 100).toFixed(2) + '%';
  if (!sign) return (n < 0 ? '-' : '') + s;
  return (n > EPS ? '+' : n < -EPS ? '-' : '') + s;
};
const shs = (n) => {
  const r = Math.round(n * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : String(r);
};
const px = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const cls = (n) => (n > EPS ? 'up' : n < -EPS ? 'down' : 'dim');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5));
const num = (v) => {
  const n = parseFloat(String(v).replace(/[,\s$]/g, ''));
  return isFinite(n) ? n : NaN;
};

/* ============================== 核心推导（FIFO） ============================== */
function compute() {
  const bySym = new Map();
  for (const t of S.trades) {
    if (!bySym.has(t.symbol)) bySym.set(t.symbol, []);
    bySym.get(t.symbol).push(t);
  }

  const positions = [], closed = [];
  let fees = 0;
  for (const t of S.trades) fees += t.fee || 0;

  for (const [symbol, list] of bySym) {
    const lots = [];
    let name = '';
    for (const t of list) {
      if (t.name) name = t.name;
      const feePer = t.shares > EPS ? (t.fee || 0) / t.shares : 0;
      if (t.side === 'buy') {
        // 买入手续费摊进每股成本
        lots.push({ shares: t.shares, perShare: t.price + feePer, date: t.date });
      } else {
        // 卖出手续费从每股收入里扣
        const net = t.price - feePer;
        let remain = t.shares;
        while (remain > EPS && lots.length) {
          const lot = lots[0];
          const q = Math.min(remain, lot.shares);
          closed.push({
            symbol, name, shares: q, openDate: lot.date, closeDate: t.date,
            buyPrice: lot.perShare, sellPrice: net,
            pnl: (net - lot.perShare) * q,
            days: daysBetween(lot.date, t.date),
          });
          lot.shares -= q; remain -= q;
          if (lot.shares <= EPS) lots.shift();
        }
        if (remain > EPS) {
          // 卖出股数超过已记录的买入（缺失建仓流水）——按零成本计，并标记
          closed.push({
            symbol, name, shares: remain, openDate: t.date, closeDate: t.date,
            buyPrice: 0, sellPrice: net, pnl: net * remain, days: 0, orphan: true,
          });
        }
      }
    }
    if (lots.length) {
      const shares = lots.reduce((s, l) => s + l.shares, 0);
      const cost = lots.reduce((s, l) => s + l.shares * l.perShare, 0);
      const p = S.prices[symbol];
      const hasPrice = !!(p && isFinite(p.price));
      const last = hasPrice ? p.price : cost / shares;
      positions.push({
        symbol, name, shares, cost, avg: cost / shares,
        last, hasPrice, priceAt: p ? p.at : null,
        mv: shares * last, pl: shares * last - cost,
        plPct: cost > EPS ? (shares * last - cost) / cost : 0,
        openDate: lots[0].date,
      });
    }
  }

  positions.sort((a, b) => b.mv - a.mv);
  closed.sort((a, b) => (a.closeDate < b.closeDate ? 1 : a.closeDate > b.closeDate ? -1 : 0));

  const mv = positions.reduce((s, p) => s + p.mv, 0);
  const cost = positions.reduce((s, p) => s + p.cost, 0);
  const unreal = positions.reduce((s, p) => s + (p.hasPrice ? p.pl : 0), 0);
  const real = closed.reduce((s, c) => s + c.pnl, 0);
  const closedCost = closed.reduce((s, c) => s + c.buyPrice * c.shares, 0);
  const invested = cost + closedCost;

  return {
    positions, closed, fees,
    mv, cost, unreal, real,
    unrealPct: cost > EPS ? unreal / cost : NaN,
    total: real + unreal,
    totalPct: invested > EPS ? (real + unreal) / invested : NaN,
  };
}

/* ============================== render ============================== */
/* 显示名：流水里存的优先，否则回退到股票库的中文名 */
const nameOf = (symbol, stored) => stored || (CAT_MAP.get(symbol) ? CAT_MAP.get(symbol).c : '');

const EMPTY_ICON = '<svg viewBox="0 0 24 24"><path d="M3 13h4l3 7 4-16 3 9h4"/></svg>';
const empty = (msg) => `<div class="empty">${EMPTY_ICON}<div>${msg}</div></div>`;

function render() {
  const c = compute();
  renderOverview(c);
  renderHoldings(c);
  renderTrades();
  renderStats(c);
}

function renderOverview(c) {
  $('#o-total').textContent = money(c.total, true);
  $('#o-total').className = 'big num ' + cls(c.total);
  $('#o-total-pct').textContent = isFinite(c.totalPct) ? pct(c.totalPct, true) + ' · 相对总投入成本' : '还没有记录';
  $('#o-total-pct').className = 'sub num ' + cls(c.total);

  $('#o-mv').textContent = money(c.mv);
  $('#o-cost').textContent = '成本 ' + money(c.cost);
  $('#o-unreal').textContent = money(c.unreal, true);
  $('#o-unreal').className = 'v num ' + cls(c.unreal);
  $('#o-unreal-pct').textContent = isFinite(c.unrealPct) ? pct(c.unrealPct, true) : '—';
  $('#o-real').textContent = money(c.real, true);
  $('#o-real').className = 'v num ' + cls(c.real);
  $('#o-real-x').textContent = c.closed.length + ' 笔平仓';
  $('#o-fee').textContent = money(c.fees);
  $('#o-trades').textContent = S.trades.length + ' 笔交易';

  $('#o-chart').innerHTML = monthlyChart(c.closed);

  const top = c.positions.slice(0, 5);
  $('#o-holdings').innerHTML = top.length
    ? top.map(posRow).join('')
    : empty('还没有持仓<br>点右下角 + 记第一笔买入');
}

function posRow(p) {
  const warn = p.hasPrice ? '' : ' · <span style="color:var(--accent)">未设现价</span>';
  return `<button class="row" data-sym="${esc(p.symbol)}">
    <div class="main">
      <div class="t1">${esc(p.symbol)}${nameOf(p.symbol, p.name) ? ' <span class="dim" style="font-weight:400;font-size:12.5px">' + esc(nameOf(p.symbol, p.name)) + '</span>' : ''}</div>
      <div class="t2 num">${shs(p.shares)} 股 · 成本 ${px(p.avg)} · 现价 ${px(p.last)}${warn}</div>
    </div>
    <div class="side">
      <div class="r1 num">${money(p.mv)}</div>
      <div class="r2 num ${p.hasPrice ? cls(p.pl) : 'faint'}">${p.hasPrice ? money(p.pl, true) + ' (' + pct(p.plPct, true) + ')' : '—'}</div>
      <div class="r2" style="margin-top:1px">${chgBadge(priceChange(S.prices[p.symbol]))}</div>
    </div>
  </button>`;
}

function renderHoldings(c) {
  $('#h-mv').textContent = money(c.mv);
  $('#h-pl').textContent = money(c.unreal, true);
  $('#h-pl').className = 'v num ' + cls(c.unreal);
  $('#h-list').innerHTML = c.positions.length
    ? c.positions.map(posRow).join('')
    : empty('还没有持仓');
  renderHot();
}

/* ---------- 热门行情：只做涨跌展示，不做走势图；顺序可手动拖拽 ---------- */
function hotRow(symbol) {
  const item = CAT_MAP.get(symbol);
  const p = S.prices[symbol];
  const has = p && isFinite(p.price);
  return `<div class="hot-item" data-sym="${esc(symbol)}">
    <button class="row hot-tap" data-sym="${esc(symbol)}">
      <div class="main">
        <div class="t1">${esc(symbol)}${item ? ' <span class="dim" style="font-weight:400;font-size:12.5px">' + esc(item.c) + '</span>' : ''}</div>
        <div class="t2 num">${has ? '更新于 ' + p.at : '点击设置最新价'}</div>
      </div>
      <div class="side">
        <div class="r1 num">${has ? px(p.price) : '—'}</div>
        <div class="r2" style="margin-top:1px">${chgBadge(priceChange(p))}</div>
      </div>
    </button>
    <button class="drag-handle" aria-label="拖动排序" data-sym="${esc(symbol)}">
      <svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
    </button>
  </div>`;
}

/* 用户拖过的顺序存在 S.config.hotOrder 里；HOT 数组里新加的代码（比如以后再加新股）
   自动补在末尾，不会因为用户存过一份旧顺序就消失；HOT 里被删掉的代码也会自动从存的顺序里滤掉 */
function hotDisplayOrder() {
  const saved = Array.isArray(S.config.hotOrder) ? S.config.hotOrder.filter((s) => HOT.includes(s)) : [];
  const missing = HOT.filter((s) => !saved.includes(s));
  return [...saved, ...missing];
}

function renderHot() {
  const el = $('#h-hot');
  if (el) el.innerHTML = hotDisplayOrder().map(hotRow).join('');
}

/* 拖拽排序：只有按住 .drag-handle 才会触发，不影响点击整行去设置价格。
   用 Pointer Events + setPointerCapture，move/up 事件会一直跟着最初按下的那个 handle，
   不管手指划到哪；用委托监听（不是绑在具体元素上），renderHot() 重画列表也不会失效。 */
let hotDrag = null;
$('#h-hot').addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.drag-handle');
  if (!handle) return;
  const item = handle.closest('.hot-item');
  if (!item) return;
  handle.setPointerCapture(e.pointerId);
  item.classList.add('dragging');
  hotDrag = { pid: e.pointerId };
  e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
  if (!hotDrag || e.pointerId !== hotDrag.pid) return;
  const item = document.querySelector('#h-hot .hot-item.dragging');
  if (!item) return;
  const container = item.parentElement;
  for (const sib of [...container.children]) {
    if (sib === item) continue;
    const r = sib.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const itemIsBefore = !!(item.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (itemIsBefore && e.clientY > mid) { container.insertBefore(item, sib.nextSibling); break; }
    if (!itemIsBefore && e.clientY < mid) { container.insertBefore(item, sib); break; }
  }
});
function endHotDrag(e) {
  if (!hotDrag || e.pointerId !== hotDrag.pid) return;
  hotDrag = null;
  const item = document.querySelector('#h-hot .hot-item.dragging');
  if (!item) return;
  item.classList.remove('dragging');
  S.config.hotOrder = [...item.parentElement.children].map((el) => el.dataset.sym);
  saveConfig();
}
document.addEventListener('pointerup', endHotDrag);
document.addEventListener('pointercancel', endHotDrag);

function renderTrades() {
  const list = [...S.trades].reverse();
  if (!list.length) { $('#t-list').innerHTML = empty('还没有流水<br>点右下角 + 记一笔'); return; }
  const groups = new Map();
  for (const t of list) {
    const k = t.date.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  let html = '';
  for (const [month, ts] of groups) {
    const buy = ts.filter((t) => t.side === 'buy').reduce((s, t) => s + t.shares * t.price + (t.fee || 0), 0);
    const sell = ts.filter((t) => t.side === 'sell').reduce((s, t) => s + t.shares * t.price - (t.fee || 0), 0);
    html += `<div class="sec"><h2>${month.replace('-', ' 年 ')} 月</h2>
      <span class="faint num" style="margin-left:auto;font-size:11.5px">买 ${money(buy)} · 卖 ${money(sell)}</span></div>
      <div class="card">${ts.map(tradeRow).join('')}</div>`;
  }
  $('#t-list').innerHTML = html;
}

function tradeRow(t) {
  const amt = t.shares * t.price;
  return `<button class="row" data-tid="${t.id}">
    <div class="main">
      <div class="t1"><span class="tag ${t.side === 'buy' ? 'b' : 's'}">${t.side === 'buy' ? '买' : '卖'}</span> ${esc(t.symbol)}${nameOf(t.symbol, t.name) ? ' <span class="dim" style="font-weight:400;font-size:12.5px">' + esc(nameOf(t.symbol, t.name)) + '</span>' : ''}</div>
      <div class="t2 num">${t.date} · ${shs(t.shares)} 股 @ ${px(t.price)}${t.fee ? ' · 费 ' + money(t.fee) : ''}${t.note ? ' · ' + esc(t.note) : ''}</div>
    </div>
    <div class="side">
      <div class="r1 num ${t.side === 'buy' ? 'dim' : ''}">${t.side === 'buy' ? '-' : '+'}${money(amt)}</div>
    </div>
  </button>`;
}

function renderStats(c) {
  const cl = c.closed;
  const wins = cl.filter((x) => x.pnl > EPS);
  const losses = cl.filter((x) => x.pnl < -EPS);
  const avgWin = wins.length ? wins.reduce((s, x) => s + x.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, x) => s + x.pnl, 0) / losses.length) : 0;

  $('#s-win').textContent = cl.length ? pct(wins.length / cl.length) : '—';
  $('#s-win-x').textContent = cl.length ? `${wins.length} 胜 / ${losses.length} 负` : '—';
  $('#s-pf').textContent = avgLoss > EPS ? (avgWin / avgLoss).toFixed(2) : (avgWin > EPS ? '∞' : '—');
  $('#s-days').textContent = cl.length ? (cl.reduce((s, x) => s + x.days, 0) / cl.length).toFixed(0) + ' 天' : '—';

  const best = cl.reduce((a, b) => (!a || b.pnl > a.pnl ? b : a), null);
  const worst = cl.reduce((a, b) => (!a || b.pnl < a.pnl ? b : a), null);
  $('#s-best').textContent = best ? money(best.pnl, true) : '—';
  $('#s-best').className = 'v num ' + (best ? cls(best.pnl) : 'dim');
  $('#s-worst').textContent = worst ? '最差 ' + money(worst.pnl, true) : '最差 —';

  $('#s-closed').innerHTML = cl.length ? cl.map(closedRow).join('') : empty('还没有平仓交易');
}

function closedRow(x) {
  const ret = x.buyPrice > EPS ? (x.sellPrice - x.buyPrice) / x.buyPrice : NaN;
  return `<div class="row">
    <div class="main">
      <div class="t1">${esc(x.symbol)}${nameOf(x.symbol, x.name) ? ' <span class="dim" style="font-weight:400;font-size:12.5px">' + esc(nameOf(x.symbol, x.name)) + '</span>' : ''}${x.orphan ? ' <span class="tag s">缺建仓</span>' : ''}</div>
      <div class="t2 num">${shs(x.shares)} 股 · ${px(x.buyPrice)} → ${px(x.sellPrice)} · 持 ${x.days} 天</div>
    </div>
    <div class="side">
      <div class="r1 num ${cls(x.pnl)}">${money(x.pnl, true)}</div>
      <div class="r2 num ${cls(x.pnl)}">${isFinite(ret) ? pct(ret, true) : '—'}</div>
    </div>
  </div>`;
}

/* ---------- 月度盈亏柱状图（纯 SVG） ---------- */
function monthlyChart(closed) {
  const map = new Map();
  for (const x of closed) {
    const k = x.closeDate.slice(0, 7);
    map.set(k, (map.get(k) || 0) + x.pnl);
  }
  if (!map.size) return `<div class="empty" style="padding:30px 10px">还没有平仓盈亏</div>`;

  const keys = [...map.keys()].sort().slice(-12);
  const vals = keys.map((k) => map.get(k));
  const max = Math.max(...vals.map(Math.abs), 1);

  const W = 320, H = 118, PAD = 4;
  const bw = (W - PAD * 2) / keys.length;
  const zero = H / 2;
  let bars = '', labels = '';
  keys.forEach((k, i) => {
    const v = vals[i];
    const h = Math.max(2, (Math.abs(v) / max) * (H / 2 - 12));
    const x = PAD + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const y = v >= 0 ? zero - h : zero;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5"
             fill="${v >= 0 ? 'var(--up)' : 'var(--down)'}" opacity=".9"/>`;
    const ty = v >= 0 ? y - 4 : y + h + 9;
    bars += `<text class="lbl" x="${(x + w / 2).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle"
             fill="${v >= 0 ? 'var(--up)' : 'var(--down)'}" font-size="8.5">${v >= 0 ? '+' : '-'}${Math.round(Math.abs(v))}</text>`;
    labels += `<text class="lbl" x="${(x + w / 2).toFixed(1)}" y="${H + 12}" text-anchor="middle">${k.slice(2).replace('-', '/')}</text>`;
  });

  return `<svg viewBox="0 -6 ${W} ${H + 22}" preserveAspectRatio="none" style="height:160px">
    <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="var(--line)" stroke-width="1"/>
    ${bars}${labels}
  </svg>`;
}

/* ============================== 导航 ============================== */
const TITLES = { overview: '概览', holdings: '持仓', trades: '流水', stats: '统计' };
function go(v) {
  S.view = v;
  $$('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + v));
  $$('nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  $('#title').textContent = TITLES[v];
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) go(g.dataset.go);
});

/* ============================== sheet ============================== */
let openSheet = null;
function sheet(id) {
  if (openSheet) openSheet.classList.remove('on');
  openSheet = id ? $(id) : null;
  $('#mask').classList.toggle('on', !!openSheet);
  if (openSheet) openSheet.classList.add('on');
}
$('#mask').addEventListener('click', () => sheet(null));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 1900);
}

/* ============================== 记一笔 ============================== */
function openTrade(t) {
  S.editId = t ? t.id : null;
  S.side = t ? t.side : 'buy';
  $('#tr-title').textContent = t ? '编辑记录' : '记一笔';
  $('#tr-symbol').value = t ? t.symbol : '';
  $('#tr-name').value = t ? t.name || '' : '';
  $('#tr-shares').value = t ? shs(t.shares) : '';
  $('#tr-price').value = t ? t.price : '';
  $('#tr-date').value = t ? t.date : today();
  $('#tr-fee').value = t && t.fee ? t.fee : '';
  $('#tr-note').value = t ? t.note || '' : '';
  $('#tr-delete').style.display = t ? 'flex' : 'none';
  syncSide();
  amountHint();
  closePop();
  sheet('#sheet-trade');
}

function syncSide() {
  $$('#tr-side button').forEach((b) => b.classList.toggle('on', b.dataset.side === S.side));
}
$('#tr-side').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S.side = b.dataset.side;
  syncSide();
  amountHint();
});

function amountHint() {
  const sh = num($('#tr-shares').value), p = num($('#tr-price').value), f = num($('#tr-fee').value) || 0;
  if (!isFinite(sh) || !isFinite(p)) { $('#tr-amount').textContent = '成交金额 —'; return; }
  const gross = sh * p;
  const net = S.side === 'buy' ? gross + f : gross - f;
  $('#tr-amount').textContent = `成交金额 ${money(gross)}　${S.side === 'buy' ? '实付' : '实收'} ${money(net)}`;
}
['#tr-shares', '#tr-price', '#tr-fee'].forEach((s) => $(s).addEventListener('input', amountHint));

/* ---------- 股票代码可搜索下拉 ---------- */
const CATALOG = window.STOCKS || [];
const CAT_MAP = new Map(CATALOG.map((x) => [x.s, x]));

/* 热门行情 — 只做「价格变动」，不做走势图。这是精选的高关注度标的子集，
   与交易流水完全独立：没持仓也能看，纯粹用来手动记一手最新价、看涨跌。 */
const HOT = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'SPCX', 'AVGO',
  'TSM', 'AMD', 'NFLX', 'ORCL', 'PLTR', 'COIN', 'MSTR',
  'BABA', 'PDD', 'JD', 'NIO',
  'SPY', 'QQQ', 'IBIT', 'GLD',
];

/* 根据 prices 记录里的 prevPrice 算涨跌；没有上一次记录就返回 null（不瞎猜） */
function priceChange(p) {
  if (!p || !isFinite(p.price) || !isFinite(p.prevPrice) || p.prevPrice <= EPS) return null;
  const diff = p.price - p.prevPrice;
  return { diff, pct: diff / p.prevPrice };
}
const chgBadge = (ch) => {
  if (!ch) return '<span class="faint" style="font-size:12.5px">已记录 · 下次更新见涨跌</span>';
  const c = cls(ch.diff);
  const arrow = ch.diff > EPS ? '▲' : ch.diff < -EPS ? '▼' : '●';
  return `<span class="num ${c}" style="font-size:12.5px;font-weight:650">${arrow} ${pct(Math.abs(ch.pct))}</span>`;
};

/* ============================== 联网刷新行情（可选） ==============================
   默认完全离线；只有在设置里填了 Finnhub 免费 Key 之后，点「刷新行情」才会真的发请求。
   选 Finnhub 是因为它原生支持浏览器 CORS（实测 access-control-allow-origin: *），而且
   免费层没有「每日总量」限制，只按分钟限速（60 次/分钟）——不会出现「今天额度用完了」。
   代价是免费版 /quote 一次只能查一个代码，刷新一批要顺序逐个请求，中间留了间隔防止触发限速。
   请求只带股票代码，不带任何交易 / 持仓数据。 */
const QUOTE_BASE = 'https://finnhub.io/api/v1';
const QUOTE_DELAY_MS = 200; // 每支代码之间留 200ms 间隔，避免一次性并发把接口打懵；
                            // 一次刷新总共也就 20~30 支，全部发完远用不到 60 次/分钟的限速
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 把 Finnhub /quote 单代码响应规整成 {price, prevPrice}；
   代码不存在或没数据时 Finnhub 返回 c=0，不是报错，要识别出来跳过，不能当成真实价格存下 */
function parseQuote(item) {
  if (!item || typeof item !== 'object') return null;
  const price = Number(item.c);
  const prev = Number(item.pc);
  if (!isFinite(price) || price <= EPS) return null;
  const rec = { price };
  if (isFinite(prev) && prev > EPS) rec.prevPrice = prev;
  return rec;
}

function symbolsToRefresh() {
  const held = compute().positions.map((p) => p.symbol);
  return [...new Set([...HOT, ...held])];
}

async function refreshQuotes() {
  if (!S.config.apiKey) {
    toast('先在设置里填一个免费的行情 Key');
    return openSettings();
  }
  const symbols = symbolsToRefresh();
  if (!symbols.length) return toast('没有需要刷新的代码');

  const btn = $('#h-refresh');
  const labelEl = $('#h-refresh-label');
  const label = labelEl ? labelEl.textContent : '';
  if (btn) btn.disabled = true;

  let ok = 0;
  const failed = [];
  const records = [];
  try {
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (labelEl) labelEl.textContent = `刷新中 ${i + 1}/${symbols.length}`;
      let data;
      try {
        const url = `${QUOTE_BASE}/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(S.config.apiKey)}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
          toast('Key 无效，去设置里检查一下');
          failed.push(...symbols.slice(i));
          break; // key 错了，后面每一支都会一样失败，不用逐个再试
        }
        if (res.status === 429) {
          toast('请求太快被限速了，等一会再刷新');
          failed.push(...symbols.slice(i));
          break;
        }
        data = await res.json();
      } catch (netErr) {
        toast('联网失败，请检查网络连接');
        failed.push(...symbols.slice(i));
        break; // 断网了，没必要继续逐个重试
      }
      const got = parseQuote(data);
      if (!got) { failed.push(sym); continue; }
      const old = S.prices[sym];
      const rec = { symbol: sym, price: got.price, at: today() };
      if (isFinite(got.prevPrice)) { rec.prevPrice = got.prevPrice; rec.prevAt = '昨收'; }
      else if (old) { rec.prevPrice = old.prevPrice; rec.prevAt = old.prevAt; }
      records.push(rec);
      ok++;
      if (i < symbols.length - 1) await sleep(QUOTE_DELAY_MS);
    }
    if (records.length) await DB.bulk('prices', records);
  } finally {
    if (btn) btn.disabled = false;
    if (labelEl) labelEl.textContent = label;
  }

  S.config.lastRefreshAt = Date.now();
  await saveConfig();
  await load();
  render();
  if (ok) toast(failed.length ? `已更新 ${ok} 支，${failed.length} 支失败` : `已更新 ${ok} 支价格`);
}
/* 打分排序：代码全等 > 代码前缀 > 中文前缀 > 英文前缀 > 英文词首 > 代码包含 > 中文包含 > 英文包含
   同档内按代码字母序，保证结果稳定 */
function search(q) {
  q = q.trim();
  if (!q) return null;
  const U = q.toUpperCase(), L = q.toLowerCase();
  const hits = [];
  for (const x of CATALOG) {
    const e = x.e.toLowerCase();
    let r = 99;
    if (x.s === U) r = 0;
    else if (x.s.startsWith(U)) r = 1;
    else if (x.c.startsWith(q)) r = 2;
    else if (e.startsWith(L)) r = 3;                                  // Microsoft ← "micro"
    else if (e.split(/[\s.&-]+/).some((w) => w.startsWith(L))) r = 4;  // Advanced Micro… ← "micro"
    else if (x.s.includes(U)) r = 5;
    else if (x.c.includes(q)) r = 6;
    else if (e.includes(L)) r = 7;
    if (r < 99) hits.push({ x, r });
  }
  hits.sort((a, b) => a.r - b.r || a.x.s.localeCompare(b.x.s));
  return hits.slice(0, 40).map((h) => h.x);
}

const mark = (text, q) => {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
};

function optRow(x, q, held) {
  return `<button class="opt" data-pick="${esc(x.s)}">
    <span class="sym">${mark(x.s, q)}</span>
    <span class="cn">${mark(x.c, q)}</span>
    ${held ? '<span class="held">持仓</span>' : ''}
    <span class="en">${esc(x.e)}</span>
  </button>`;
}

function popup() {
  const q = $('#tr-symbol').value.trim();
  const pop = $('#tr-pop');
  const heldSet = new Set(compute().positions.map((p) => p.symbol));

  if (!q) {
    // 空输入时给「我的持仓」+「最近交易过」作为快捷入口
    const recent = [];
    const seen = new Set();
    for (let i = S.trades.length - 1; i >= 0 && recent.length < 8; i--) {
      const sym = S.trades[i].symbol;
      if (seen.has(sym)) continue;
      seen.add(sym);
      recent.push(CAT_MAP.get(sym) || { s: sym, c: S.trades[i].name || '', e: '' });
    }
    if (!recent.length) {
      pop.innerHTML = `<div class="hd">热门</div>` +
        CATALOG.slice(0, 12).map((x) => optRow(x, '', false)).join('');
    } else {
      pop.innerHTML = `<div class="hd">最近交易</div>` +
        recent.map((x) => optRow(x, '', heldSet.has(x.s))).join('');
    }
    pop.classList.add('on');
    return;
  }

  const hits = search(q);
  pop.innerHTML = hits.length
    ? `<div class="hd">${hits.length} 个匹配</div>` + hits.map((x) => optRow(x, q, heldSet.has(x.s))).join('')
    : `<div class="none">库里没有「${esc(q)}」<br>直接用这个代码也可以，正常保存即可</div>`;
  pop.classList.add('on');
}

const closePop = () => $('#tr-pop').classList.remove('on');

$('#tr-symbol').addEventListener('input', () => {
  const v = $('#tr-symbol').value;
  // 纯字母时自动转大写，输中文不干扰
  if (/^[a-zA-Z.]*$/.test(v) && v !== v.toUpperCase()) {
    const p = $('#tr-symbol').selectionStart;
    $('#tr-symbol').value = v.toUpperCase();
    $('#tr-symbol').setSelectionRange(p, p);
  }
  popup();
});
$('#tr-symbol').addEventListener('focus', popup);
$('#tr-symbol').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const first = $('#tr-pop .opt');
    if (first && $('#tr-pop').classList.contains('on')) first.click();
    else closePop();
  } else if (e.key === 'Escape') closePop();
});

$('#tr-pop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  const sym = b.dataset.pick;
  const item = CAT_MAP.get(sym);
  $('#tr-symbol').value = sym;
  // 已有名称不覆盖用户手填的内容
  if (item) $('#tr-name').value = item.c;
  closePop();
  if (!$('#tr-shares').value) $('#tr-shares').focus();
});

/* 点到别处收起下拉 */
$('#sheet-trade').addEventListener('click', (e) => {
  if (!e.target.closest('.combo')) closePop();
});

$('#tr-cancel').addEventListener('click', () => sheet(null));
$('#fab').addEventListener('click', () => openTrade(null));
$('#h-refresh').addEventListener('click', refreshQuotes);

$('#tr-save').addEventListener('click', async () => {
  const symbol = $('#tr-symbol').value.trim().toUpperCase();
  const shares = num($('#tr-shares').value);
  const price = num($('#tr-price').value);
  const date = $('#tr-date').value;
  const fee = num($('#tr-fee').value) || 0;

  if (!symbol) return toast('请填写股票代码');
  if (!isFinite(shares) || shares <= 0) return toast('股数需为大于 0 的数字');
  if (!isFinite(price) || price < 0) return toast('成交价不正确');
  if (!date) return toast('请选择成交日期');

  const t = {
    id: S.editId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    symbol, name: $('#tr-name').value.trim() || (CAT_MAP.get(symbol) ? CAT_MAP.get(symbol).c : ''),
    side: S.side, shares, price, date, fee,
    note: $('#tr-note').value.trim(),
  };
  await DB.put('trades', t);
  await load();
  render();
  sheet(null);
  toast(S.editId ? '已更新' : '已记录');
});

$('#tr-delete').addEventListener('click', async () => {
  if (!S.editId || !confirm('删除这笔记录？该股票的持仓与盈亏会重新计算。')) return;
  await DB.del('trades', S.editId);
  await load();
  render();
  sheet(null);
  toast('已删除');
});

/* ============================== 更新现价 ============================== */
function openPrice(symbol) {
  S.editSymbol = symbol;
  const p = S.prices[symbol];
  const pos = compute().positions.find((x) => x.symbol === symbol);
  const label = nameOf(symbol, pos && pos.name) || (CAT_MAP.get(symbol) ? CAT_MAP.get(symbol).c : '');
  $('#pr-title').textContent = symbol + (label ? ' · ' + label : '');
  $('#pr-price').value = p && isFinite(p.price) ? p.price : '';
  const posLine = pos ? `持有 ${shs(pos.shares)} 股 · 每股成本 ${px(pos.avg)}<br>` : '';
  const statusLine = p ? `上次更新 ${p.at} · 较前一次 ${chgBadge(priceChange(p))}` : (pos ? '尚未设置现价，浮动盈亏按成本价计为 0' : '还没有价格记录');
  $('#pr-hint').innerHTML = posLine + statusLine;
  $('#pr-trades').innerHTML = S.trades.filter((t) => t.symbol === symbol).reverse().map(tradeRow).join('')
    || empty('无流水');
  sheet('#sheet-price');
}
$('#pr-cancel').addEventListener('click', () => sheet(null));
$('#pr-save').addEventListener('click', async () => {
  const v = num($('#pr-price').value);
  if (!isFinite(v) || v < 0) return toast('请输入有效价格');
  const old = S.prices[S.editSymbol];
  const rec = { symbol: S.editSymbol, price: v, at: today() };
  if (old && isFinite(old.price)) {
    // 价格真的变了才滚动「上一次」；同一天反复改同一个数不会把涨跌记录抹掉
    if (Math.abs(old.price - v) > EPS) { rec.prevPrice = old.price; rec.prevAt = old.at; }
    else { rec.prevPrice = old.prevPrice; rec.prevAt = old.prevAt; }
  }
  await DB.put('prices', rec);
  await load();
  render();
  sheet(null);
  toast('现价已更新');
});

/* 行点击分发 */
document.addEventListener('click', (e) => {
  const sym = e.target.closest('[data-sym]');
  if (sym) return openPrice(sym.dataset.sym);
  const tid = e.target.closest('[data-tid]');
  if (tid) {
    const t = S.trades.find((x) => x.id === tid.dataset.tid);
    if (t) openTrade(t);
  }
});

/* ============================== 设置 / 备份 ============================== */
function openSettings() {
  $('#st-about').innerHTML =
    `Ledger v${VERSION} · 本地数据完全离线<br>${S.trades.length} 笔流水 · ${Object.keys(S.prices).length} 个现价<br>` +
    `<span id="st-quota">存储用量 计算中…</span>`;
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then((q) => {
      const el = $('#st-quota');
      if (el) el.textContent = `存储用量 ${(q.usage / 1024).toFixed(1)} KB / 配额 ${(q.quota / 1048576).toFixed(0)} MB`;
    }).catch(() => {});
  }
  $('#cfg-key').value = S.config.apiKey || '';
  $('#cfg-auto').checked = !!S.config.autoOnOpen;
  $('#cfg-status').textContent = S.config.apiKey
    ? (S.config.lastRefreshAt ? '已配置 · 上次刷新 ' + new Date(S.config.lastRefreshAt).toLocaleString('zh-CN') : '已配置 · 还没刷新过')
    : '未配置 · 当前完全离线';
  syncThemeSeg();
  sheet('#sheet-settings');
}
$('#btn-settings').addEventListener('click', openSettings);
$('#st-cancel').addEventListener('click', () => sheet(null));

function syncThemeSeg() {
  $$('#theme-seg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === S.config.theme));
}
$('#theme-seg').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S.config.theme = b.dataset.theme;
  applyTheme();
  syncThemeSeg();
  await saveConfig();
});

$('#cfg-save').addEventListener('click', async () => {
  S.config.apiKey = $('#cfg-key').value.trim();
  S.config.autoOnOpen = $('#cfg-auto').checked;
  await saveConfig();
  toast(S.config.apiKey ? '已保存，可以点「刷新行情」了' : '已清空 Key，恢复纯离线模式');
  $('#cfg-status').textContent = S.config.apiKey ? '已配置 · 还没刷新过' : '未配置 · 当前完全离线';
});
$('#cfg-clear').addEventListener('click', async () => {
  $('#cfg-key').value = '';
  S.config.apiKey = '';
  S.config.autoOnOpen = false;
  $('#cfg-auto').checked = false;
  await saveConfig();
  $('#cfg-status').textContent = '未配置 · 当前完全离线';
  toast('已清空，恢复纯离线模式');
});

$('#st-export').addEventListener('click', async () => {
  const data = {
    app: 'ledger', version: VERSION, exportedAt: new Date().toISOString(),
    trades: S.trades, prices: Object.values(S.prices),
  };
  const json = JSON.stringify(data, null, 2);
  const name = `ledger-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  // iOS 上优先走系统分享 → 可存到「文件」/ iCloud Drive
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('已导出 ' + name);
});

$('#st-import').addEventListener('click', () => $('#st-file').click());
$('#st-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  e.target.value = '';
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.trades)) throw new Error('缺少 trades 字段');
    if (!confirm(`导入 ${d.trades.length} 笔流水？现有数据会被覆盖。`)) return;
    await DB.clear('trades'); await DB.clear('prices');
    await DB.bulk('trades', d.trades);
    if (Array.isArray(d.prices)) await DB.bulk('prices', d.prices);
    await load(); render(); sheet(null);
    toast(`已导入 ${d.trades.length} 笔`);
  } catch (err) {
    alert('导入失败：' + err.message);
  }
});

$('#st-clear').addEventListener('click', async () => {
  if (!confirm('清空全部流水和现价？此操作不可撤销，建议先导出备份。')) return;
  await DB.clear('trades'); await DB.clear('prices');
  await load(); render(); sheet(null);
  toast('已清空');
});

$('#st-refresh-app').addEventListener('click', async () => {
  toast('正在清缓存…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    // 清缓存本身失败也没关系，下面照样强制刷新，最坏情况就是没清干净
  }
  location.reload(true);
});

$('#st-demo').addEventListener('click', async () => {
  if (S.trades.length && !confirm('当前已有数据，示例数据会追加进去。继续？')) return;
  const mk = (symbol, name, side, shares, price, date, fee, note) =>
    ({ id: Math.random().toString(36).slice(2, 11), symbol, name, side, shares, price, date, fee, note: note || '' });
  const demo = [
    mk('AAPL', 'Apple', 'buy', 50, 172.4, '2026-01-08', 1, '财报前建仓'),
    mk('AAPL', 'Apple', 'buy', 30, 165.1, '2026-02-14', 1, '回调加仓'),
    mk('AAPL', 'Apple', 'sell', 50, 198.6, '2026-04-22', 1, '兑现一半'),
    mk('NVDA', 'NVIDIA', 'buy', 20, 118.9, '2026-01-20', 1, ''),
    mk('NVDA', 'NVIDIA', 'sell', 20, 104.3, '2026-03-05', 1, '止损'),
    mk('MSFT', 'Microsoft', 'buy', 25, 402.7, '2026-03-11', 1, ''),
    mk('TSLA', 'Tesla', 'buy', 40, 219.5, '2026-05-06', 1, ''),
    mk('TSLA', 'Tesla', 'sell', 40, 251.8, '2026-07-18', 1, '到目标价'),
    mk('SPY', 'S&P 500 ETF', 'buy', 15, 548.2, '2026-06-02', 0, '定投'),
    mk('SPY', 'S&P 500 ETF', 'buy', 15, 561.9, '2026-08-01', 0, '定投'),
  ];
  const prices = [
    { symbol: 'AAPL', price: 205.3, at: today() },
    { symbol: 'MSFT', price: 388.4, at: today() },
    { symbol: 'SPY', price: 573.1, at: today() },
  ];
  await DB.bulk('trades', demo);
  await DB.bulk('prices', prices);
  await load(); render(); sheet(null);
  toast('示例数据已载入');
});

/* ============================== boot ============================== */
(async function boot() {
  try {
    await load();
  } catch (err) {
    alert('无法打开本地数据库：' + err.message + '\n（无痕模式下 IndexedDB 可能不可用）');
  }
  applyTheme();
  render();
  go('overview');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // updateViaCache:'none' → sw.js 本身永远不走 HTTP 缓存，每次都问服务器要不要更新，
      // 避免出现「代码明明换了，App 却一直跑旧版本」这种事。
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    });
    // 新版本的 Service Worker 一旦接管页面，说明有更新落地了，自动刷新一次直接用上新代码，
    // 不用用户自己去清缓存。用一个标记防止重复刷新。
    let swRefreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swRefreshed) return;
      swRefreshed = true;
      location.reload();
    });
  }
  // 打开 App 自动刷新一次；15 分钟内已经刷新过就不重复刷，省额度
  const AUTO_REFRESH_COOLDOWN = 15 * 60 * 1000;
  if (S.config.apiKey && S.config.autoOnOpen && Date.now() - (S.config.lastRefreshAt || 0) > AUTO_REFRESH_COOLDOWN) {
    refreshQuotes();
  }
})();
