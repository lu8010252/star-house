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
  Promise.resolve(f()).then(h => { $('#main').innerHTML = h; $('#main').classList.remove('filtering'); if (S.tab === 'dash' && $('#chart')) drawCharts(); });
}
const kidSel = () => `<select data-a="kid">${S.children.map(c => `<option value="${c.id}" ${c.id === S.cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;

// ---- 看板 ----
let ST = null;
async function dash() {
  if (!S.cid) return '<div class="box">先到「孩子管理」添加孩子</div>';
  ST = await api(`/stats?childId=${S.cid}&month=${S.month}`);
  const T = await api('/today');
  const { cur: a, prev: b } = ST, d = a.net - b.net;
  const today = `<div class="box"><h3>今日概览 <small style="color:var(--ink2);font-weight:400">${T.d}</small></h3><div class="today">${T.kids.map(k => `<div class="tk"><b>${esc(k.name)}</b><span class="tp">⭐ ${k.points}</span><span class="p">+${k.gain}</span><span class="n">-${k.loss}</span><span class="${k.checked ? 'ok' : 'no'}">${k.checked ? '✅ 已打卡' : '⬜ 未打卡'}</span></div>`).join('')}</div>
    <h4 class="sub">🎁 待兑现奖励 <small>${T.pending.length}</small></h4>${T.pending.map(r => `<div class="pd"><span>${esc(r.child)} · ${esc(r.name)} <small>⭐${r.cost} · ${esc(r.d)}</small></span><button class="b" data-a="done" data-id="${r.id}">已兑现</button></div>`).join('') || '<div class="empty2">没有待兑现的奖励</div>'}</div>`;
  return today + `<div class="box"><div class="bar">当前孩子 ${kidSel()} <button class="b g" data-a="mm" data-n="-1">←</button><b>${a.month}</b><button class="b g" data-a="mm" data-n="1">→</button><small>对比 ${b.month}</small></div>
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
  rules: [{ k: 'icon', l: '图标', w: 'ic' }, { k: 'name', l: '规则名称', w: 'nm' }, { k: 'type', l: '类型', sel: [['good', '加分项'], ['bad', '扣分项']] }, { k: 'points', l: '分值', num: 1 }, { k: 'group', l: '分组(如 学习/生活)', list: 'grps' }],
  shop: [{ k: 'icon', l: '图标', w: 'ic' }, { k: 'name', l: '商品名称', w: 'nm' }, { k: 'cost', l: '所需积分', num: 1 }, { k: 'stock', l: '库存(空=不限)', num: 1 }, { k: 'weekly', l: '每周限兑(0=不限)', num: 1 }],
};
// 编辑/新增表单。type 不为空时(在某一栏里新增)用隐藏字段带上类型
function form(coll, o, type) {
  const isNew = !o.id;
  const f = FIELDS[coll].map(f => f.sel && !isNew
    ? `<label class="f"><small>${f.l}</small><select data-k="${f.k}">${f.sel.map(([v, t]) => `<option value="${v}" ${o[f.k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`
    : f.sel ? `<input type="hidden" data-k="${f.k}" value="${type}">`
    : `<label class="f ${f.w || ''}"><small>${f.l}</small><input data-k="${f.k}" type="${f.num ? 'number' : 'text'}" ${f.list ? `list="${f.list}"` : ''} placeholder="${f.l}" value="${esc(o[f.k] ?? '')}"></label>`).join('');
  const extra = coll === 'rules' ? `<div class="fx">${S.children.length > 1 ? `<small>适用孩子(都不选=全部)</small>${S.children.map(c => `<label class="ck"><input type="checkbox" class="kidchk" value="${c.id}" ${(o.kids || []).includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}` : ''}<label class="ck"><input type="checkbox" data-k="off" ${o.off ? 'checked' : ''}>停用</label></div>` : '';
  return `<div class="frm" data-coll="${coll}" data-id="${o.id || ''}">${f}${extra}<div class="fb"><button class="b" data-a="${isNew ? 'add' : 'save'}">${isNew ? '添加' : '保存'}</button><button class="b g" data-a="cancel">取消</button></div></div>`;
}
function item(coll, o) {
  if (S.edit === coll + o.id) return form(coll, o);
  const pill = coll === 'rules' ? (o.type === 'bad' ? `-${o.points}` : `+${o.points}`) : `⭐ ${o.cost}`;
  const kn = (o.kids || []).map(id => S.children.find(c => c.id === id)?.name).filter(Boolean);
  const tags = (coll === 'rules'
    ? [o.group && `<em>${esc(o.group)}</em>`, kn.length && `<em class="k">仅${esc(kn.join('、'))}</em>`, o.off && '<em class="x">已停用</em>']
    : [o.stock != null && `<em class="${o.stock <= 0 ? 'x' : ''}">${o.stock <= 0 ? '已兑完' : '库存 ' + o.stock}</em>`, o.weekly > 0 && `<em>每周${o.weekly}次</em>`]).filter(Boolean).join('');
  return `<div class="it ${coll === 'rules' ? o.type : 'shop'} ${o.off ? 'off' : ''}" data-coll="${coll}" data-id="${o.id}" data-name="${esc(o.name + ' ' + (o.group || ''))}"><span class="grip" title="按住拖动排序">⠿</span><span class="nm" title="${esc(o.name)}">${o.icon ? esc(o.icon) + ' ' : ''}${esc(o.name)}</span><span class="tg">${tags}</span><span class="pill">${pill}</span>${coll === 'rules' ? `<button class="ib" data-a="toggle" title="${o.off ? '启用' : '停用'}">${o.off ? '▶' : '⏸'}</button>` : ''}<button class="ib" data-a="edit" title="编辑">✎</button><button class="ib r" data-a="del" title="删除">🗑</button></div>`;
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
  const gs = [...new Set(S.rules.map(r => r.group).filter(Boolean))];
  return `<div class="box"><datalist id="grps">${gs.map(x => `<option value="${esc(x)}">`).join('')}</datalist><div class="tool"><h3>赏罚规则</h3>${search('搜索名称或分组')}</div>
    <div class="cols">${column('rules', 'good', '👍 加分项', g, 'good')}${column('rules', 'bad', '⚠️ 扣分项', b, 'bad')}</div>
    <p class="hint">按住左侧 ⠿ 上下拖动即可排序(手机也行),手机前台按这里的顺序显示。点 ✎ 可改名称/分值/图标/分组/适用孩子;⏸ 可临时停用(前台不显示,历史记录不受影响)。设了分组的规则,前台按分组折叠显示。</p></div>`;
};
const shop = () => `<div class="box"><div class="tool"><h3>兑换商品</h3>${search('搜索商品')}</div>
  <div class="cols one">${column('shop', 'shop', '🎁 商品列表', S.shop)}</div>
  <p class="hint">按住左侧 ⠿ 上下拖动即可排序,前台商城按这里的顺序显示。库存兑完后前台变灰;每周限兑按「周一至周日」、每个孩子单独计数。</p></div>`;

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
S.lf = { from: '', to: '', kind: '' };
async function logs() {
  if (!S.cid) return '<div class="box">先添加孩子</div>';
  const f = S.lf, qs = `childId=${S.cid}&limit=${f.from || f.to || f.kind ? 500 : 150}${f.from ? '&from=' + f.from : ''}${f.to ? '&to=' + f.to : ''}${f.kind ? '&kind=' + f.kind : ''}`;
  const l = await api('/logs?' + qs), rs = S.rules.filter(r => !r.off);
  const opt = ([v, t]) => `<option value="${v}" ${f.kind === v ? 'selected' : ''}>${t}</option>`;
  const sum = l.filter(x => x.type !== 'redeem').reduce((a, x) => a + x.delta, 0);
  return `<div class="box"><h3>手动加扣分</h3>
    <div class="bar"><small>给谁</small>${S.children.map(c => `<label class="ck"><input type="checkbox" class="tgt" value="${c.id}" ${c.id === S.cid ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}<small style="color:var(--ink2)">可多选,一次同时加扣</small></div>
    <div class="bar"><select id="mrule"><option value="">自选分数</option>${rs.map(r => `<option value="${r.id}">${r.type === 'bad' ? '-' : '+'}${r.points} ${esc(r.icon || '')}${esc(r.name)}</option>`).join('')}</select><input id="md" type="number" placeholder="分数(扣分填负数)" style="width:150px"><input id="mr" placeholder="原因"><button class="b" data-a="manual">提交</button></div></div>
   <div class="box"><h3>积分记录</h3><div class="bar">${kidSel()}<input type="date" data-lf="from" value="${f.from}"><small>至</small><input type="date" data-lf="to" value="${f.to}">
     <select data-lf="kind">${[['', '全部'], ['gain', '只看加分'], ['loss', '只看扣分'], ['redeem', '只看兑换']].map(opt).join('')}</select><small>共 ${l.length} 条 · 净得分 <b class="${sum >= 0 ? 'p' : 'n'}">${sign(sum)}</b></small></div>
    <table>${l.map(x => `<tr><td>${fmtTime(x.ts)}</td><td>${esc(x.reason)}</td><td class="${x.delta >= 0 ? 'p' : 'n'}">${x.delta ? sign(x.delta) : '-'}</td><td><button class="b g" data-a="undo" data-id="${x.id}">撤销</button></td></tr>`).join('') || '<tr><td>暂无</td></tr>'}</table></div>`;
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
  <p class="hint">登录密码在 docker-compose.yml 的 PASSWORD 中修改。</p></div>
  <div class="box"><h3>数据备份</h3><div class="bar"><button class="b" data-a="export">导出备份</button><button class="b g" data-a="import">导入备份</button></div>
  <p class="hint">备份包含孩子、规则、商城、全部积分与学习记录(一个 json 文件)。导入会覆盖当前数据,服务器会自动留一份旧数据副本。孩子的照片文件在数据目录的 uploads 里,换服务器时请一并拷贝。</p></div>`; };

// ---- 事件 ----
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-t],[data-a]'); if (!t) return;
  if (t.dataset.t) { S.tab = t.dataset.t; store.set('xa_tab', S.tab); return render(); }
  const a = t.dataset.a, row = t.closest('.ed,.frm,.it'), val = k => $(`[data-k=${k}]`, row)?.value;
  const body = () => { const o = Object.fromEntries($$('[data-k]', row).map(i => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.value])); if ($('.kidchk', row)) o.kids = $$('.kidchk:checked', row).map(x => +x.value); return o; };
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
    else if (a === 'manual') {
      const ids = $$('.tgt:checked').map(x => +x.value), rid = $('#mrule').value, d = +$('#md').value | 0;
      if (!ids.length) return toast('请选择孩子');
      if (!rid && !d) return toast('请选规则或输入分数');
      await api('/score', 'POST', rid ? { childIds: ids, ruleId: +rid } : { childIds: ids, delta: d, reason: $('#mr').value }); toast(`已记录(${ids.length}人)`); await load();
    }
    else if (a === 'toggle') { const r = S.rules.find(x => x.id === +row.dataset.id); await api('/rules/' + r.id, 'PUT', { off: !r.off }); toast(r.off ? '已启用' : '已停用'); await load(); }
    else if (a === 'done') { await api('/redeems/' + t.dataset.id, 'PUT', { done: true }); toast('已标记兑现'); render(); }
    else if (a === 'export') { const j = await api('/export'), x = document.createElement('a'); x.href = URL.createObjectURL(new Blob([JSON.stringify(j)], { type: 'application/json' })); x.download = `star-house-${new Date().toISOString().slice(0, 10)}.json`; x.click(); toast('已导出'); }
    else if (a === 'import') {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
      i.onchange = async () => { try { const o = JSON.parse(await i.files[0].text()); if (!confirm('导入会覆盖当前全部数据(服务器会自动留一份旧数据副本),确定?')) return; await api('/import', 'POST', { db: o }); toast('导入成功'); await load(); } catch (er) { toast(er.message || '文件不对'); } };
      i.click();
    }
    else if (a === 'undo') { if (confirm('撤销这条记录并回退积分?')) { await api('/logs/' + t.dataset.id, 'DELETE'); await load(); } }
    else if (a === 'stdel') { if (confirm('删除这条学习记录?')) { await api('/study/' + t.dataset.id, 'DELETE'); render(); } }
    else if (a === 'setsave') { await api('/settings', 'PUT', { checkinPoints: $('#s1').value, focusPer10: $('#s3').value, focusTasks: $('#s4').value.split(/[,,、]/), subjects: $('#s5').value.split(/[,,、]/), kinds: $('#s6').value.split(/[,,、]/) }); toast('已保存'); await load(); }
  } catch (er) { toast(er.message); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.a === 'kid') { S.cid = +t.value; render(); }
  else if (t.dataset.lf) { S.lf[t.dataset.lf] = t.value; render(); }
  else if (t.id === 'mrule') { const r = S.rules.find(x => x.id === +t.value); if (r) { $('#md').value = r.type === 'bad' ? -r.points : r.points; $('#mr').value = r.name; } }
});

requireLogin('家长后台', load);
