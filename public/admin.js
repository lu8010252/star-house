// 星星屋 · 家长后台
const S = { children: [], rules: [], shop: [], settings: {}, cid: 0, tab: store.get('xa_tab') || 'dash', month: '', edit: '', add: '' };
const TABS = [['dash', '📊', '首页看板'], ['kids', '🧒', '孩子管理'], ['rules', '⚖️', '赏罚规则'], ['shop', '🛍️', '商城'], ['logs', '📜', '积分记录'], ['study', '📚', '学习记录'], ['set', '⚙️', '系统设置']];
const ym = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
S.month = ym(new Date());
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 1 + n, 1)); };

async function load() {
  Object.assign(S, await api('/state'), { edit: '', add: '' });
  if (!S.children.some(c => c.id === S.cid)) S.cid = S.children[0]?.id || 0;
  render();
}

function render() {
  $('#tabs').innerHTML = TABS.map(([k, ic, n]) => `<button data-t="${k}" class="${S.tab === k ? 'on' : ''}"><i>${ic}</i>${n}</button>`).join('');
  const f = { dash, kids, rules, shop, logs, study, set }[S.tab];
  Promise.resolve(f()).then(h => { $('#main').innerHTML = h; $('#main').classList.remove('filtering'); if (S.tab === 'dash') drawCharts(); });
}
const kidSel = () => `<select data-a="kid">${S.children.map(c => `<option value="${c.id}" ${c.id === S.cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;

// ---- 看板 ----
let ST = null;
async function dash() {
  if (!S.cid) return '<div class="box">先到「孩子管理」添加孩子</div>';
  ST = await api(`/stats?childId=${S.cid}&month=${S.month}`);
  const { cur: a, prev: b } = ST, d = a.net - b.net;
  return `<div class="box"><div class="bar">当前孩子 ${kidSel()} <button class="b g" data-a="mm" data-n="-1">←</button><b>${a.month}</b><button class="b g" data-a="mm" data-n="1">→</button><small>对比 ${b.month}</small></div>
    <div class="stats"><div><small>${a.month} 净得分</small><b>${a.net}</b></div><div><small>${b.month} 净得分</small><b>${b.net}</b></div><div><small>环比变化</small><b class="${d >= 0 ? 'p' : 'n'}">${sign(d)}</b></div></div></div>
    <div class="box"><h3>月度积分对比 <small style="color:var(--ink2);font-weight:400">每日净得分</small></h3><div class="legend"><span><i style="background:#6f8bff"></i>${a.month}</span><span><i style="background:#c3a5ff"></i>${b.month}</span></div><div id="chart"></div></div>
    <div class="box"><h3>积分分类对比 <small style="color:var(--ink2);font-weight:400">加分向上、扣分向下</small></h3><div class="cmp"><div><b>${a.month}</b>${bars(a)}</div><div><b>${b.month}</b>${bars(b)}</div></div></div>`;
}
function bars(m) {
  const all = [...Object.values(m.gainBy), ...Object.values(m.lossBy)], mx = Math.max(1, ...all);
  const row = (k, v, c, s) => `<div class="hr"><span style="width:90px">${esc(k)}</span><div class="t"><i style="width:${v / mx * 100}%;background:${c}"></i></div><b class="${s > 0 ? 'p' : 'n'}">${s > 0 ? '+' : '-'}${v}</b></div>`;
  const h = Object.entries(m.gainBy).map(([k, v]) => row(k, v, '#7be0bd', 1)).join('') + Object.entries(m.lossBy).map(([k, v]) => row(k, v, '#ff9aa9', -1)).join('');
  return h || '<div style="color:var(--ink2);padding:8px 0">暂无数据</div>';
}
function drawCharts() {
  const { cur: a, prev: b } = ST, W = 640, H = 220, L = 36, B = 24, n = 31;
  const all = [...a.daily, ...b.daily], mn = Math.min(0, ...all), mx = Math.max(1, ...all), rg = mx - mn || 1;
  const x = i => L + i * (W - L - 10) / (n - 1), y = v => 10 + (H - B - 10) * (1 - (v - mn) / rg);
  const line = (arr, c, dash) => `<polyline fill="none" stroke="${c}" stroke-width="3" ${dash ? 'stroke-dasharray="6 5"' : ''} points="${arr.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>` + arr.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#fff" stroke="${c}" stroke-width="2"/>`).join('');
  let g = ''; for (let i = 0; i <= 4; i++) { const v = mn + rg * i / 4; g += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" fill="#8a7aa8" text-anchor="end">${Math.round(v)}</text>`; }
  for (let d = 1; d <= 31; d += 5) g += `<text x="${x(d - 1)}" y="${H - 6}" font-size="11" fill="#8a7aa8" text-anchor="middle">${d}日</text>`;
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}${line(b.daily, '#c3a5ff', true)}${line(a.daily, '#6f8bff')}</svg>`;
}

// ---- 可排序列表:赏罚规则 / 商城 ----
const FIELDS = {
  rules: [{ k: 'name', l: '规则名称' }, { k: 'type', l: '类型', sel: [['good', '加分项'], ['bad', '扣分项']] }, { k: 'points', l: '分值', num: 1 }],
  shop: [{ k: 'name', l: '商品名称' }, { k: 'cost', l: '所需积分', num: 1 }],
};
// 编辑/新增表单。type 不为空时(在某一栏里新增)用隐藏字段带上类型
function form(coll, o, type) {
  const isNew = !o.id;
  const f = FIELDS[coll].map(f => f.sel && !isNew
    ? `<select data-k="${f.k}">${f.sel.map(([v, t]) => `<option value="${v}" ${o[f.k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`
    : f.sel ? `<input type="hidden" data-k="${f.k}" value="${type}">`
    : `<input data-k="${f.k}" type="${f.num ? 'number' : 'text'}" placeholder="${f.l}" title="${f.l}" value="${esc(o[f.k] ?? '')}">${f.num ? '<small>分</small>' : ''}`).join('');
  return `<div class="frm" data-coll="${coll}" data-id="${o.id || ''}">${f}<button class="b" data-a="${isNew ? 'add' : 'save'}">${isNew ? '添加' : '保存'}</button><button class="b g" data-a="cancel">取消</button></div>`;
}
function item(coll, o) {
  if (S.edit === coll + o.id) return form(coll, o);
  const pill = coll === 'rules' ? (o.type === 'bad' ? `-${o.points}` : `+${o.points}`) : `⭐ ${o.cost}`;
  return `<div class="it ${coll === 'rules' ? o.type : 'shop'}" data-coll="${coll}" data-id="${o.id}" data-name="${esc(o.name)}"><span class="grip" title="按住拖动排序">⠿</span><span class="nm" title="${esc(o.name)}">${esc(o.name)}</span><span class="pill">${pill}</span><button class="ib" data-a="edit" title="编辑">✎</button><button class="ib r" data-a="del" title="删除">🗑</button></div>`;
}
function column(coll, cls, title, list, type) {
  const key = coll + ':' + (type || '');
  const defs = coll === 'rules' ? { name: '', type, points: type === 'bad' ? 5 : 10 } : { name: '', cost: 50 };
  return `<div class="col ${cls}"><div class="colh">${title}<span>${list.length}</span></div>
    <div class="lst" data-coll="${coll}">${list.map(o => item(coll, o)).join('') || '<div class="empty2">还没有,点下面添加</div>'}</div>
    ${S.add === key ? `<div style="margin-top:8px">${form(coll, defs, type)}</div>` : `<button class="addbtn" data-a="addopen" data-key="${key}">＋ 添加${coll === 'rules' ? (type === 'bad' ? '扣分项' : '加分项') : '商品'}</button>`}</div>`;
}
const search = ph => `<input id="q" class="q" type="text" placeholder="🔍 ${ph}" autocomplete="off">`;
const rules = () => {
  const g = S.rules.filter(r => r.type !== 'bad'), b = S.rules.filter(r => r.type === 'bad');
  return `<div class="box"><div class="tool"><h3>赏罚规则</h3>${search('搜索规则名称')}</div>
    <div class="cols">${column('rules', 'good', '👍 加分项', g, 'good')}${column('rules', 'bad', '⚠️ 扣分项', b, 'bad')}</div>
    <p class="hint">按住左侧 ⠿ 上下拖动即可排序(手机也行),手机前台按这里的顺序显示。点 ✎ 可修改名称、分值,或把加分项改成扣分项。</p></div>`;
};
const shop = () => `<div class="box"><div class="tool"><h3>兑换商品</h3>${search('搜索商品')}</div>
  <div class="cols one">${column('shop', 'shop', '🎁 商品列表', S.shop)}</div>
  <p class="hint">按住左侧 ⠿ 上下拖动即可排序,前台商城按这里的顺序显示。</p></div>`;

// 搜索:只在页面上隐藏/显示,不重绘(输入不丢焦点);搜索时暂停排序
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  const q = e.target.value.trim().toLowerCase();
  $('#main').classList.toggle('filtering', !!q);
  $$('.it').forEach(x => { x.style.display = !q || x.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
});

// 拖拽排序(指针事件,鼠标/触屏通用)
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g || $('#main.filtering')) return;
  const el = g.closest('.it'), list = el.parentNode; e.preventDefault();
  el.classList.add('drag');
  const mv = ev => {
    if (ev.clientY < 90) scrollBy(0, -14); else if (ev.clientY > innerHeight - 90) scrollBy(0, 14);
    const u = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.it');
    if (u && u !== el && u.parentNode === list) { const r = u.getBoundingClientRect(); list.insertBefore(el, ev.clientY < r.top + r.height / 2 ? u : u.nextSibling); }
  };
  const up = () => {
    document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    el.classList.remove('drag'); saveOrder(el.dataset.coll);
  };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
});
async function saveOrder(coll) {
  const ids = $$(`[data-coll=${coll}][data-id]:not([data-id=""])`).map(x => +x.dataset.id);
  const pos = new Map(ids.map((id, i) => [id, i]));
  if (ids.every((id, i) => S[coll][i]?.id === id)) return; // 没变化
  S[coll].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  try { await api(`/${coll}/order`, 'PUT', { ids }); toast('顺序已保存'); } catch (er) { toast(er.message); load(); }
}

// ---- 孩子 ----
const kids = () => `<div class="box"><h3>孩子管理</h3><small style="color:var(--ink2)">可选内置卡通形象,也可以上传照片(会裁成圆形显示在前台大卡片右侧)</small>
  ${S.children.map(c => `<div class="kid ed" data-id="${c.id}">${c.avatar ? `<img class="ava" src="${esc(c.avatar)}">` : `<span class="ava">${esc(c.name[0])}</span>`}<input data-k="name" value="${esc(c.name)}"><b>⭐${c.points}</b>
    <button class="b g" data-a="pre" data-v="/avatars/girl-a.svg">卡通一</button><button class="b g" data-a="pre" data-v="/avatars/girl-b.svg">卡通二</button><button class="b g" data-a="ava">上传照片</button><button class="b" data-a="kidsave">保存</button><button class="b r" data-a="kiddel">删除</button></div>`).join('')}
  <div class="kid ed"><input id="newkid" placeholder="新孩子名字"><button class="b" data-a="kidadd">＋ 添加孩子</button></div></div>`;

// ---- 记录 ----
async function logs() {
  if (!S.cid) return '<div class="box">先添加孩子</div>';
  const l = await api(`/logs?childId=${S.cid}&limit=150`);
  return `<div class="box"><h3>手动加扣分</h3><div class="bar">${kidSel()}<input id="md" type="number" placeholder="分数(扣分填负数)" style="width:150px"><input id="mr" placeholder="原因" ><button class="b" data-a="manual">提交</button></div></div>
   <div class="box"><h3>积分记录</h3><table>${l.map(x => `<tr><td>${fmtTime(x.ts)}</td><td>${esc(x.reason)}</td><td class="${x.delta >= 0 ? 'p' : 'n'}">${x.delta ? sign(x.delta) : '-'}</td><td><button class="b g" data-a="undo" data-id="${x.id}">撤销</button></td></tr>`).join('') || '<tr><td>暂无</td></tr>'}</table></div>`;
}

// ---- 学习记录 ----
async function study() {
  if (!S.cid) return '<div class="box">先添加孩子</div>';
  const l = await api(`/study?childId=${S.cid}`);
  return `<div class="box"><h3>学习记录</h3><div class="bar">${kidSel()}<small>共 ${l.length} 条</small></div><table>${l.map(x => `<tr><td>${x.d}</td><td>${esc(x.subject)} · ${esc(x.kind)}</td><td><b>${esc(x.score) || '✓'}</b></td><td>${esc(x.note)}</td><td><button class="b r" data-a="stdel" data-id="${x.id}">删除</button></td></tr>`).join('') || '<tr><td>暂无</td></tr>'}</table></div>`;
}

// ---- 设置 ----
const set = () => { const s = S.settings; return `<div class="box"><h3>系统设置</h3>
  <div class="frow"><small>每日打卡得分</small><input id="s1" type="number" value="${s.checkinPoints}"></div>
  <div class="frow"><small>专注每 10 分钟得分</small><input id="s3" type="number" value="${s.focusPer10}"></div>
  <div class="frow"><small>专注任务(逗号分隔)</small><input id="s4" value="${esc((s.focusTasks || []).join(','))}"></div>
  <div class="frow"><small>学习科目(逗号分隔)</small><input id="s5" value="${esc((s.subjects || []).join(','))}"></div>
  <div class="frow"><small>学习类型(逗号分隔)</small><input id="s6" value="${esc((s.kinds || []).join(','))}"></div>
  <div style="margin-top:14px"><button class="b" data-a="setsave">保存设置</button></div>
  <p class="hint">登录密码在 docker-compose.yml 的 PASSWORD 中修改。</p></div>`; };

// ---- 事件 ----
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-t],[data-a]'); if (!t) return;
  if (t.dataset.t) { S.tab = t.dataset.t; store.set('xa_tab', S.tab); return render(); }
  const a = t.dataset.a, row = t.closest('.ed,.frm,.it'), val = k => $(`[data-k=${k}]`, row)?.value;
  const body = () => Object.fromEntries($$('[data-k]', row).map(i => [i.dataset.k, i.value]));
  try {
    if (a === 'edit') { S.edit = row.dataset.coll + row.dataset.id; render(); }
    else if (a === 'cancel') { S.edit = ''; S.add = ''; render(); }
    else if (a === 'addopen') { S.add = t.dataset.key; S.edit = ''; render(); }
    else if (a === 'mm') { S.month = shiftMonth(S.month, +t.dataset.n); render(); }
    else if (a === 'add') { await api('/' + row.dataset.coll, 'POST', body()); toast('已添加'); await load(); }
    else if (a === 'save') { await api(`/${row.dataset.coll}/${row.dataset.id}`, 'PUT', body()); toast('已保存'); await load(); }
    else if (a === 'del') { if (confirm('确定删除?')) { await api(`/${row.dataset.coll}/${row.dataset.id}`, 'DELETE'); await load(); } }
    else if (a === 'kidadd') { await api('/children', 'POST', { name: $('#newkid').value }); await load(); }
    else if (a === 'kidsave') { await api('/children/' + row.dataset.id, 'PUT', { name: val('name') }); toast('已保存'); await load(); }
    else if (a === 'kiddel') { if (confirm('删除该孩子及其所有记录?此操作不可恢复')) { await api('/children/' + row.dataset.id, 'DELETE'); await load(); } }
    else if (a === 'pre') { await api('/children/' + row.dataset.id, 'PUT', { avatar: t.dataset.v }); toast('形象已更新'); await load(); }
    else if (a === 'ava') { const url = await pickImage(900); await api('/children/' + row.dataset.id, 'PUT', { avatar: url }); toast('形象图已更新'); await load(); }
    else if (a === 'manual') { const d = +$('#md').value | 0; if (!d) return toast('请输入分数'); await api('/score', 'POST', { childId: S.cid, delta: d, reason: $('#mr').value }); toast('已记录'); await load(); }
    else if (a === 'undo') { if (confirm('撤销这条记录并回退积分?')) { await api('/logs/' + t.dataset.id, 'DELETE'); await load(); } }
    else if (a === 'stdel') { if (confirm('删除这条学习记录?')) { await api('/study/' + t.dataset.id, 'DELETE'); render(); } }
    else if (a === 'setsave') { await api('/settings', 'PUT', { checkinPoints: $('#s1').value, focusPer10: $('#s3').value, focusTasks: $('#s4').value.split(/[,,、]/), subjects: $('#s5').value.split(/[,,、]/), kinds: $('#s6').value.split(/[,,、]/) }); toast('已保存'); await load(); }
  } catch (er) { toast(er.message); }
});
document.addEventListener('change', e => { if (e.target.dataset.a === 'kid') { S.cid = +e.target.value; render(); } });

requireLogin('家长后台', load);
