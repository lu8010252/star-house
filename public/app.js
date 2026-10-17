// 星星屋 · 手机前台
const S = { children: [], rules: [], shop: [], settings: {}, checkins: [], today: '', cid: +store.get('xt_cid') || 0, tab: store.get('xt_tab') || 'score' };
const F = { task: '', minutes: 30, endAt: 0, running: false }; // 专注状态
const NAVI = {"score": "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"M15.5 13.5 17 22l-5-3-5 3 1.5-8.5\"/></svg>", "study": "<svg viewBox=\"0 0 24 24\"><path d=\"M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z\"/><path d=\"M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z\"/></svg>", "focus": "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l2.5 2.5M9 2h6\"/></svg>", "shop": "<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"/><path d=\"M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5\"/></svg>", "me": "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7\"/></svg>"};
const TABS = [['score', NAVI.score, '赏罚'], ['study', NAVI.study, '学习'], ['focus', NAVI.focus, '专注'], ['shop', NAVI.shop, '商城'], ['me', NAVI.me, '我的']];
const HERO = {
  score: ['赏罚分明', '每一次好表现,<br>都值得被看见!', '#ffcf4d', '#fff3c9'],
  shop: ['快乐补给站', '攒积分,<br>换好礼!', '#ff7eb6', '#ffe3f0'],
  focus: ['专注时刻', '安静一点点,<br>进步一大步!', '#9b7bff', '#ece6ff'],
  study: ['笔墨留香', '今天也要<br>闪闪发光呀!', '#6aa8ff', '#e2efff'],
  me: ['成长档案', '记录每一天,<br>书写成长篇章', '#9b7bff', '#ece6ff'],
};
const cur = () => S.children.find(c => c.id === S.cid) || S.children[0];
const placeholder = `<svg class="mascot" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="112" r="62" fill="#ffe6d2"/><path d="M38 108C34 56 74 34 100 34s66 22 62 74c-14-26-36-38-62-38s-48 12-62 38z" fill="#5a3b7a"/><circle cx="52" cy="62" r="17" fill="#ff7eb6"/><circle cx="148" cy="62" r="17" fill="#ff7eb6"/><circle cx="52" cy="62" r="6" fill="#ffd45e"/><circle cx="148" cy="62" r="6" fill="#ffd45e"/><ellipse cx="78" cy="116" rx="7" ry="9" fill="#3b2a5c"/><ellipse cx="122" cy="116" rx="7" ry="9" fill="#3b2a5c"/><circle cx="80" cy="112" r="2.5" fill="#fff"/><circle cx="124" cy="112" r="2.5" fill="#fff"/><circle cx="64" cy="134" r="8" fill="#ffb3cf" opacity=".7"/><circle cx="136" cy="134" r="8" fill="#ffb3cf" opacity=".7"/><path d="M88 140q12 12 24 0" stroke="#e9559a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
const mascot = c => (c && c.avatar ? `<img class="mascot ${c.avatar.startsWith('/avatars/') ? '' : 'photo'}" src="${esc(c.avatar)}" alt="">` : placeholder);

function hero(tab, extra = '') {
  const [t, p, c, cl] = HERO[tab], ch = cur();
  return `<div class="hero" style="--c:${c};--cl:${cl}"><h1>${t}</h1><div class="bar"></div><p>${p}</p>
    <div><span class="pts">⭐ <b>${ch ? ch.points : 0}</b></span><button class="who" data-a="switch">${esc(ch ? ch.name : '添加孩子')} ▾</button></div>${extra}${mascot(ch)}</div>`;
}

// ---------- 弹窗 ----------
// 返回键逻辑:先关弹窗 → 退出二级页 → 回「赏罚」首页 → 退出
// 网页:用浏览历史(返回键/手势);APK(Capacitor):直接拦截系统返回键(需 @capacitor/app 插件)
let mOpen = false, ignorePop = 0;
const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
const hist = !CapApp;
const pushH = () => { if (hist) history.pushState({ tab: S.tab, me: meV }, ''); };
function modal(html, onOk, okText = '确定') {
  if (!mOpen) { mOpen = true; pushH(); }
  const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}<div class="mb"><button data-x="no">${onOk ? '取消' : '关闭'}</button>${onOk ? `<button class="ok" data-x="ok">${okText}</button>` : ''}</div></div>`;
  m.onclick = async e => {
    const x = e.target.dataset.x;
    if (e.target === m || x === 'no') return close();
    if (x === 'ok') { try { if ((await onOk()) !== false) close(); } catch (er) { toast(er.message); } }
  };
}
function closeModal(fromPop) {
  $('#modal').innerHTML = '';
  if (mOpen) { mOpen = false; if (hist && !fromPop) { ignorePop++; history.back(); } }
}
const close = () => closeModal(false);
addEventListener('popstate', e => {
  if (!hist) return;
  if (ignorePop > 0) { ignorePop--; return; }
  if (mOpen) return closeModal(true);
  const st = e.state || {}; S.tab = st.tab || 'score'; meV = st.me || ''; store.set('xt_tab', S.tab); render();
});
function goBack() { // APK 返回键:返回 true 表示已处理
  if (mOpen) { closeModal(false); return true; }
  if (S.tab === 'me' && meV) { meV = ''; render(); return true; }
  if (S.tab !== 'score') { S.tab = 'score'; store.set('xt_tab', S.tab); render(); return true; }
  return false;
}
if (CapApp) CapApp.addListener('backButton', () => { if (!goBack()) CapApp.exitApp(); });
const ask = (title, msg, fn) => modal(`<h3>${title}</h3><p>${msg}</p>`, fn);

// ---------- 页面 ----------
async function refresh() { Object.assign(S, await api('/state')); if (!S.children.some(c => c.id === S.cid)) S.cid = S.children[0]?.id || 0; render(); }

function render() {
  $('#nav').innerHTML = TABS.map(([k, ic, n]) => `<button data-t="${k}" class="${S.tab === k ? 'on' : ''}"><span class="ic">${ic}</span>${n}</button>`).join('');
  if (!S.children.length) {
    $('#page').innerHTML = `<div class="hero">${'<h1>星星屋</h1><div class="bar"></div><p>先添加一个孩子吧</p>'}${placeholder}</div><div class="empty">还没有孩子<br><br><button class="btn" data-a="addchild">+ 添加孩子</button></div>`;
    return;
  }
  const v = { score, study, focus, shop, me }[S.tab];
  const r = v();
  if (r && r.then) r.then(h => { $('#page').innerHTML = h; }); else $('#page').innerHTML = r;
}

const grpOpen = () => { try { return JSON.parse(store.get('xt_grp') || '{}'); } catch { return {}; } };
function score() {
  const card = r => `<button class="card ${r.type}" data-a="rule" data-id="${r.id}"><span class="name">${r.icon ? esc(r.icon) + ' ' : ''}${esc(r.name)}</span><span class="pt">${r.type === 'bad' ? '-' : '+'}${r.points}</span></button>`;
  // 已停用的不显示;限定孩子的规则只对对应孩子显示
  const vis = S.rules.filter(r => !r.off && !(r.kids || []).length || (!r.off && r.kids.includes(S.cid)));
  const op = grpOpen();
  const sect = (list, tp) => {
    const m = new Map(); for (const r of list) { const k = r.group || ''; (m.get(k) || m.set(k, []).get(k)).push(r); }
    if (m.size === 1 && m.has('')) return `<div class="grid">${list.map(card).join('')}</div>`;
    return [...m].map(([k, rs]) => { const key = tp + ':' + k, open = op[key] !== false;
      return `<button class="grph" data-a="grp" data-k="${esc(key)}"><span>${open ? '▾' : '▸'} ${esc(k || '其他')}</span><small>${rs.length}</small></button>${open ? `<div class="grid">${rs.map(card).join('')}</div>` : ''}`; }).join('');
  };
  const g = vis.filter(r => r.type !== 'bad'), b = vis.filter(r => r.type === 'bad');
  return hero('score') +
    `<div class="sec"><span class="tag good">⭐ 表现不错(${g.length})</span></div>${sect(g, 'good')}` +
    `<div class="sec"><span class="tag bad">❗ 有待提高(${b.length})</span></div>${sect(b, 'bad')}` +
    `<div class="sec"><span class="tag flex">✏️ 灵活记录</span></div><div class="grid">
      <button class="card good" data-a="manual" data-s="1"><span class="name">手动加分</span><span class="pt">+</span></button>
      <button class="card bad" data-a="manual" data-s="-1"><span class="name">手动扣分</span><span class="pt">-</span></button></div>`;
}

function shop() {
  const s = S.settings;
  const item = i => {
    const used = (S.wk || []).filter(w => w.childId === S.cid && w.itemId === i.id).length;
    const out = i.stock != null && i.stock <= 0, lim = i.weekly > 0 && used >= i.weekly;
    const note = out ? '已兑完' : lim ? '本周已兑够' : [i.stock != null ? `剩 ${i.stock} 件` : '', i.weekly > 0 ? `本周还可 ${i.weekly - used} 次` : ''].filter(Boolean).join(' · ');
    return `<button class="card shop ${out || lim ? 'off' : ''}" data-a="redeem" data-id="${i.id}"><span class="name">${i.icon ? esc(i.icon) + ' ' : ''}${esc(i.name)}${note ? `<small class="nt">${note}</small>` : ''}</span><span class="pt">⭐ ${i.cost}</span></button>`;
  };
  return hero('shop') +
    `<div class="sec">🎀 快乐补给站</div><div class="big">
      <button class="card shop" data-a="checkin"><span class="em">✅</span><b>每日打卡</b><small>+${s.checkinPoints} 分</small></button></div>` +
    `<div class="sec">🛍 积分兑换</div><div class="grid">${S.shop.map(item).join('') || '<div class="empty">家长后台还没添加商品</div>'}</div>`;
}

const fmtT = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function focus() {
  const tasks = S.settings.focusTasks || [];
  if (!F.task) F.task = tasks[0] || '专注';
  const left = F.running ? Math.max(0, Math.ceil((F.endAt - Date.now()) / 1000)) : F.minutes * 60, p = F.running ? 100 - left / (F.minutes * 60) * 100 : 0;
  return hero('focus') +
    `<div class="timer" style="--p:${p}"><div><small>专注倒计时</small><span class="t" id="tt">${fmtT(left)}</span><small>${F.running ? '加油,别分心' : '准备好就开始吧'}</small></div></div>
     <div class="btns"><button class="btn" data-a="${F.running ? 'fstop' : 'fstart'}">${F.running ? '放弃' : '▶ 专注'}</button>
     <button class="btn ghost" data-a="fmin" ${F.running ? 'disabled' : ''}>${F.minutes} 分钟 ▾</button></div>
     <div class="sec">选择专注任务</div><div class="chips">${tasks.map(t => `<button class="chip ${t === F.task ? 'on' : ''}" data-a="ftask" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
     <div class="empty" style="font-size:13px">每完成 10 分钟得 ${S.settings.focusPer10} 分</div>`;
}
setInterval(() => {
  if (!F.running) return;
  const left = Math.ceil((F.endAt - Date.now()) / 1000);
  if (left <= 0) return finishFocus();
  const t = $('#tt'); if (t) { t.textContent = fmtT(left); $('.timer').style.setProperty('--p', 100 - left / (F.minutes * 60) * 100); }
}, 500);
async function finishFocus() {
  F.running = false;
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
  try { const r = await api('/focus', 'POST', { childId: S.cid, task: F.task, minutes: F.minutes }); toast(`专注完成!${r.got ? '+' + r.got + ' 分' : ''}`); await refresh(); } catch (e) { toast(e.message); }
}

// ---------- 学习 ----------
const stF = { subject: '', kind: '' };
async function study() {
  const ch = cur(), subs = S.settings.subjects || [], kinds = S.settings.kinds || [];
  const list = await api(`/study?childId=${ch.id}&subject=${encodeURIComponent(stF.subject)}&kind=${encodeURIComponent(stF.kind)}`);
  const row = (arr, key) => `<div class="chips nowrap">${['', ...arr].map(v => `<button class="chip ${stF[key] === v ? 'on' : ''}" data-a="stf" data-k="${key}" data-v="${esc(v)}">${v ? esc(v) : '全部'}</button>`).join('')}</div>`;
  return hero('study', '<button class="herobtn" data-a="stadd">＋ 记录</button>') +
    `<div class="sec">📚 科目</div>${row(subs, 'subject')}<div class="sec">📝 类型</div>${row(kinds, 'kind')}<div class="sec">学习记录</div>
     <div class="list">${list.map(x => `<div class="row"><div><b>${esc(x.subject)}</b> · ${esc(x.kind)}${x.note ? `<small>${esc(x.note)}</small>` : ''}<small>${x.d}</small></div><b class="sc">${esc(x.score) || '✓'}</b></div>`).join('') || '<div class="empty">暂无记录<br>快去记录你的学习点滴吧</div>'}</div>`;
}

// ---------- 我的(成长档案) ----------
let meV = '', calM = '';
const MENU = [['calendar', '📅', '时光日历', '看看每天的成长足迹', '#8fc2ff'], ['logs', '⭐', '积分记录', '每一次加扣分', '#ff9aa9'], ['redeem', '🛍', '兑换记录', '好物兑换历史', '#7be0bd'], ['focus', '⏱', '专注记录', '回顾认真投入的时光', '#c5aaff']];
const logRow = l => `<div class="row"><div>${esc(l.reason)}<small>${fmtTime(l.ts)}</small></div><b class="${l.delta >= 0 ? 'p' : 'n'}">${l.delta ? sign(l.delta) : '🎁'}</b></div>`;
async function me() {
  const ch = cur();
  if (!meV) return hero('me') + `<div class="sec">📁 成长档案</div><div class="menu">${MENU.map(([k, ic, t, s, c]) => `<button style="--c:${c}" data-a="mv" data-v="${k}"><span class="mi">${ic}</span><span><b>${t}</b><small>${s}</small></span><i>›</i></button>`).join('')}</div><button class="link" data-a="logout">退出登录</button>`;
  const it = MENU.find(m => m[0] === meV), head = `<button class="back" data-a="mv" data-v="">‹ 返回</button><div class="sec">${it[1]} ${it[2]}</div>`;
  if (meV === 'calendar') return head + await calendar(ch);
  if (meV === 'focus') { const f = await api(`/focus?childId=${ch.id}`); return head + `<div class="list">${f.map(x => `<div class="row"><div>${esc(x.task)}<small>${x.d}</small></div><b class="p">${x.minutes} 分钟</b></div>`).join('') || '<div class="empty">暂无记录</div>'}</div>`; }
  const logs = await api(`/logs?childId=${ch.id}&type=${meV === 'logs' ? '' : meV}&limit=80`);
  return head + `<div class="list">${logs.map(logRow).join('') || '<div class="empty">暂无记录</div>'}</div>`;
}
async function calendar(ch) {
  if (!calM) calM = S.today.slice(0, 7);
  const { days } = await api(`/calendar?childId=${ch.id}&month=${calM}`);
  const [y, m] = calM.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
  let cells = '<i></i>'.repeat(first);
  for (let d = 1; d <= n; d++) {
    const k = `${calM}-${String(d).padStart(2, '0')}`, v = days[k];
    cells += `<button class="dc ${k === S.today ? 'today' : ''} ${v && v.checkin ? 'ck' : ''}" data-a="day" data-d="${k}"><span>${d}</span>${v ? `<small class="${v.net >= 0 ? 'p' : 'n'}">${v.net ? sign(v.net) : ''}</small>${v.study ? '<em>📚</em>' : ''}` : ''}</button>`;
  }
  const ck = Object.values(days).filter(v => v.checkin).length;
  return `<div class="monthbar"><button data-a="cm" data-n="-1">‹</button><b>${y}年${m}月</b><button data-a="cm" data-n="1">›</button></div>
    <div class="cal"><div class="w">${'日一二三四五六'.split('').map(x => `<span>${x}</span>`).join('')}</div><div class="d2">${cells}</div></div>
    <div class="empty" style="font-size:13px">本月打卡 ${ck} 天(紫色底)· 点日期看当天详情</div>`;
}
const dayHtml = (d, r) => {
  const rows = [...r.logs.map(logRow),
    ...r.study.map(x => `<div class="row"><div>📚 ${esc(x.subject)} · ${esc(x.kind)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</div><b>${esc(x.score) || '✓'}</b></div>`),
    ...r.focus.map(x => `<div class="row"><div>⏱ ${esc(x.task)}</div><b class="p">${x.minutes}分</b></div>`)];
  return `<h3>${d}${r.checkin ? ' · 已打卡 ✓' : ''}</h3><div class="list" style="text-align:left;max-height:50vh;overflow:auto">${rows.join('') || '<div class="empty">这天没有记录</div>'}</div>`;
};

// ---------- 交互 ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-t],[data-a]'); if (!t) return;
  if (t.dataset.t) { const ch = S.tab !== t.dataset.t; S.tab = t.dataset.t; store.set('xt_tab', S.tab); if (ch) pushH(); return render(); }
  const a = t.dataset.a, id = +t.dataset.id;
  try {
    if (a === 'grp') { const o = grpOpen(); o[t.dataset.k] = o[t.dataset.k] === false; store.set('xt_grp', JSON.stringify(o)); render(); }
    else if (a === 'rule') { const r = S.rules.find(x => x.id === id); ask(esc(r.name), `${r.type === 'bad' ? '扣' : '加'} ${r.points} 分,确认吗?`, async () => { await api('/score', 'POST', { childId: S.cid, ruleId: id }); toast(`${r.type === 'bad' ? '-' : '+'}${r.points}`); refresh(); }); }
    else if (a === 'manual') { const s = +t.dataset.s; modal(`<h3>手动${s > 0 ? '加' : '扣'}分</h3><input id="mp" type="number" inputmode="numeric" placeholder="分数"><input id="mr" placeholder="原因(可不填)">`, async () => { const n = Math.abs(+$('#mp').value | 0); if (!n) throw new Error('请输入分数'); await api('/score', 'POST', { childId: S.cid, delta: s * n, reason: $('#mr').value }); refresh(); }); }
    else if (a === 'redeem') { const i = S.shop.find(x => x.id === id); ask('兑换', `用 ${i.cost} 分兑换「${esc(i.name)}」?`, async () => { await api('/redeem', 'POST', { childId: S.cid, itemId: id }); toast('兑换成功 🎉'); refresh(); }); }
    else if (a === 'checkin') { const r = await api('/checkin', 'POST', { childId: S.cid }); toast(`打卡成功 +${r.got}`); refresh(); }
    else if (a === 'fstart') { F.endAt = Date.now() + F.minutes * 60000; F.running = true; render(); }
    else if (a === 'fstop') ask('放弃专注?', '现在放弃就没有积分啦', async () => { F.running = false; render(); });
    else if (a === 'ftask') { F.task = t.dataset.v; render(); }
    else if (a === 'fmin') modal(`<h3>专注时长</h3><div class="chips" style="justify-content:center;margin-bottom:6px">${[10, 15, 20, 30, 45, 60].map(m => `<button class="chip" data-a="setmin" data-v="${m}">${m} 分钟</button>`).join('')}</div>`);
    else if (a === 'setmin') { F.minutes = +t.dataset.v; close(); render(); }
    else if (a === 'mv') {
      if (!t.dataset.v && hist && history.state && history.state.me) return history.back(); // 「‹ 返回」= 浏览器返回
      meV = t.dataset.v; if (meV) pushH(); render();
    }
    else if (a === 'cm') { const [y, m] = calM.split('-').map(Number), d = new Date(y, m - 1 + +t.dataset.n, 1); calM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); }
    else if (a === 'day') modal(dayHtml(t.dataset.d, await api(`/day?childId=${S.cid}&d=${t.dataset.d}`)));
    else if (a === 'stf') { stF[t.dataset.k] = t.dataset.v; render(); }
    else if (a === 'stadd') {
      const opt = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
      modal(`<h3>记录学习</h3><select id="ss">${opt(S.settings.subjects || [], stF.subject)}</select><select id="sk">${opt(S.settings.kinds || [], stF.kind)}</select><input id="sc" placeholder="成绩(如 95 / A+ / 优,可不填)"><input id="sd" type="date" value="${S.today}"><input id="sn" placeholder="备注(可不填)">`,
        async () => { await api('/study', 'POST', { childId: S.cid, subject: $('#ss').value, kind: $('#sk').value, score: $('#sc').value, d: $('#sd').value, note: $('#sn').value }); toast('已记录'); render(); });
    }
    else if (a === 'switch') {
      modal(`<h3>切换孩子</h3><div class="chips" style="justify-content:center">${S.children.map(c => `<button class="chip ${c.id === S.cid ? 'on' : ''}" data-a="pick" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>`);
    }
    else if (a === 'pick') { S.cid = id; store.set('xt_cid', id); close(); render(); }
    else if (a === 'addchild') modal(`<h3>添加孩子</h3><input id="cn" placeholder="名字">`, async () => { await api('/children', 'POST', { name: $('#cn').value }); refresh(); });
    else if (a === 'logout') { store.del('xt_token'); location.reload(); }
  } catch (er) { toast(er.message); }
});

if (hist) { history.replaceState({ tab: 'score', me: '' }, ''); if (S.tab !== 'score') history.pushState({ tab: S.tab, me: '' }, ''); } // 记住的标签不是首页时垫一层,返回先回首页
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
requireLogin('星星屋', refresh);
