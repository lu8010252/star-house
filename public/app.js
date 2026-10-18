// 星星屋 · 手机前台
const S = { children: [], rules: [], shop: [], settings: {}, checkins: [], today: '', cid: +store.get('xt_cid') || 0, tab: store.get('xt_tab') || 'score' };
const F = { task: '', minutes: Math.min(180, Math.max(1, +store.get('xt_fmin') || 30)), endAt: 0, running: false }; // 专注状态
// 提示音(WebAudio 合成,无需音频文件;需在点击「专注」时解锁)
let AC = null;
const soundOn = () => store.get('xt_fsnd') !== '0';
function unlockAudio() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch {} }
// APK:锁屏时网页被系统暂停,改用原生本地通知(带声音+震动)到点提醒
const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
const FN_ID = 1001;
async function schedFocusNotice(at, test) {
  if (!LN || (!test && !soundOn())) return;
  try {
    let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') return toast('没有通知权限,锁屏时不会提醒');
    // Android 12+:精确闹钟权限("闹钟和提醒")没开时,系统会延迟甚至不按时响
    try { const x = await LN.checkExactNotificationSetting(); if (x.exact_alarm !== 'granted') { toast('请在设置里允许"闹钟和提醒",锁屏才会准时响'); LN.changeExactNotificationSetting(); } } catch {}
    await LN.createChannel({ id: 'focus2', name: '专注提醒', importance: 5, vibration: true, visibility: 1 });
    await LN.cancel({ notifications: [{ id: FN_ID }] });
    await LN.schedule({ notifications: [{ id: FN_ID, title: test ? '测试提醒' : '专注完成啦 🎉', body: test ? '听到声音就说明锁屏提醒可用' : `${F.task} ${F.minutes} 分钟,回来领星星吧`, channelId: 'focus2', schedule: { at: new Date(at || F.endAt + 1500), allowWhileIdle: true } }] });
    if (test) toast('已设置,请锁屏等 10 秒');
  } catch (e) { toast('锁屏提醒设置失败:' + (e && e.message || e)); }
}
const cancelFocusNotice = () => { try { LN && LN.cancel({ notifications: [{ id: FN_ID }] }); } catch {} };
function playAlarm() {
  if (!soundOn()) return;
  try {
    unlockAudio(); if (!AC) return;
    const t0 = AC.currentTime + 0.05;
    for (let r = 0; r < 3; r++) [660, 880, 1100].forEach((f, i) => {
      const t = t0 + r * 1.2 + i * 0.28, o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t); o.stop(t + 0.27);
    });
  } catch {}
}
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

// 卡片小部件:本周次数 / 连续打卡 / 成绩金星 / 科目表情 / 飘字
const SUBJ = [['语文', '📖'], ['数学', '🔢'], ['英语', '🔤'], ['科学', '🔬'], ['音乐', '🎵'], ['美术', '🎨'], ['体育', '⚽'], ['书法', '✍️'], ['道德', '⚖️'], ['品德', '⚖️'], ['编程', '💻'], ['钢琴', '🎹'], ['舞蹈', '💃'], ['阅读', '📚']];
const subjIc = n => (SUBJ.find(([k]) => String(n).includes(k)) || [0, '📚'])[1];
const isGold = sc => { sc = String(sc || '').trim(); const n = parseFloat(sc); return /^(A\+?|优秀?|满分|100|S)$/i.test(sc) || (!isNaN(n) && /^[\d.]+$/.test(sc) && n >= 90); };
function streak() {
  const set = new Set(S.checkins.filter(c => c.childId === S.cid).map(c => c.d)), day = 864e5;
  const f = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let t = Date.now(), n = 0; if (!set.has(f(t))) t -= day;
  while (set.has(f(t))) { n++; t -= day; }
  return n;
}
function fly(rect, text, bad) {
  const el = document.createElement('div'); el.className = 'fly' + (bad ? ' bad' : ''); el.textContent = text;
  el.style.left = (rect.left + rect.width / 2) + 'px'; el.style.top = (rect.top + rect.height / 2) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
}

const grpOpen = () => { try { return JSON.parse(store.get('xt_grp') || '{}'); } catch { return {}; } };
function score() {
  const mine = (S.rwk || []).filter(w => w.childId === S.cid);
  const card = r => { const n = mine.filter(w => w.name === r.name).length, done = mine.some(w => w.name === r.name && w.d === S.today);
    return `<button class="card ${r.type}" data-a="rule" data-id="${r.id}">${done ? '<i class="dn">✓</i>' : ''}<span class="top"><span class="ico">${r.icon ? esc(r.icon) : (r.type === 'bad' ? '❗' : '⭐')}</span><span class="name">${esc(r.name)}</span></span><span class="foot"><span class="wk ${n ? '' : 'none'}">${n ? '本周 ×' + n : '本周还没有'}</span><span class="pt">${r.type === 'bad' ? '-' : '+'}${r.points}</span></span></button>`; };
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
    const pts = cur().points || 0, can = !out && !lim && pts >= i.cost, pct = Math.min(100, Math.max(0, pts / i.cost * 100));
    return `<button class="card shop ${out || lim ? 'off' : ''} ${can ? 'can' : ''}" data-a="redeem" data-id="${i.id}"><span class="top"><span class="ico">${i.icon ? esc(i.icon) : '🎁'}</span><span class="name">${esc(i.name)}${note ? `<small class="nt">${note}</small>` : ''}</span></span><span class="bar2"><i style="width:${pct}%"></i></span><span class="foot"><span class="wk ${can ? 'ok' : ''}">${out || lim ? '' : can ? '可兑换 ✨' : '🔒 还差 ' + (i.cost - pts) + ' 分'}</span><span class="pt">⭐ ${i.cost}</span></span></button>`;
  };
  const mk = S.checkins.filter(c => c.childId === S.cid), ckToday = mk.some(c => c.d === S.today), ckMonth = mk.filter(c => c.d.startsWith(S.today.slice(0, 7))).length, st = streak();
  return hero('shop') +
    `<div class="sec">🎀 快乐补给站</div><div class="big">
      <button class="card shop" data-a="checkin"><span class="em">${ckToday ? '🎉' : '✅'}</span><b>${ckToday ? '今日已打卡' : '每日打卡'}</b><small>+${s.checkinPoints} 分</small><span class="streak">🔥 连续 ${st} 天 · 本月 ${ckMonth} 天</span></button></div>` +
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
     <div class="btns"><button class="btn ghost" data-a="fsnd">${soundOn() ? '🔔 提示音:开' : '🔕 提示音:关'}</button>${LN ? '<button class="btn ghost" data-a="ftest">测试锁屏提醒</button>' : ''}</div>
     <div class="empty" style="font-size:13px">每完成 10 分钟得 ${S.settings.focusPer10} 分</div>`;
}
setInterval(() => {
  if (!F.running) return;
  const left = Math.ceil((F.endAt - Date.now()) / 1000);
  if (left <= 0) return finishFocus();
  const t = $('#tt'); if (t) { t.textContent = fmtT(left); $('.timer').style.setProperty('--p', 100 - left / (F.minutes * 60) * 100); }
}, 500);
async function finishFocus() {
  const late = Date.now() - F.endAt > 5000; // 锁屏期间已由系统通知提醒,解锁后不再重复响
  F.running = false; cancelFocusNotice(); if (!(LN && late)) playAlarm();
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
  try { const r = await api('/focus', 'POST', { childId: S.cid, task: F.task, minutes: F.minutes }); toast(`专注完成!${r.got ? '+' + r.got + ' 分' : ''}`); await refresh(); } catch (e) { toast(e.message); }
}

// ---------- 学习 ----------
const stF = { subject: '', kind: '' };
async function study() {
  const ch = cur(), subs = S.settings.subjects || [], kinds = S.settings.kinds || [];
  const list = await api(`/study?childId=${ch.id}&subject=${encodeURIComponent(stF.subject)}&kind=${encodeURIComponent(stF.kind)}`);
  const row = (arr, key) => `<div class="fchips">${['', ...arr].map(v => `<button class="fchip ${stF[key] === v ? 'on' : ''}" data-a="stf" data-k="${key}" data-v="${esc(v)}">${v ? esc(v) : '全部'}</button>`).join('')}</div>`;
  const hue = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  return hero('study', '<button class="herobtn" data-a="stadd">＋ 记录</button>') +
    `<div class="fpanel"><div class="frw"><span class="fl">📚<em>科目</em></span>${row(subs, 'subject')}</div><div class="frw"><span class="fl">📝<em>类型</em></span>${row(kinds, 'kind')}</div></div>
     <div class="wkbar"><span>🗓 本周学习 <b>${(S.swk || []).filter(c => c === ch.id).length}</b> 次</span><span>🏅 优秀 <b>${list.filter(x => isGold(x.score)).length}</b> 个</span><span>📒 共 <b>${list.length}</b> 条</span></div>
     <div class="sec">学习记录</div>
     <div class="list">${list.map(x => `<div class="row srow" style="--h:${hue(x.subject)}"><div><span class="sb">${subjIc(x.subject)} ${esc(x.subject)}</span><span class="sk">${esc(x.kind)}</span>${x.note ? `<small>${esc(x.note)}</small>` : ''}<small>${x.d}</small></div><b class="sc ${isGold(x.score) ? 'gold' : ''}">${isGold(x.score) ? '⭐ ' : ''}${esc(x.score) || '✓'}</b></div>`).join('') || '<div class="empty">暂无记录<br>快去记录你的学习点滴吧</div>'}</div>`;
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
    else if (a === 'rule') { const r = S.rules.find(x => x.id === id), rc = t.getBoundingClientRect(); ask(esc(r.name), `${r.type === 'bad' ? '扣' : '加'} ${r.points} 分,确认吗?`, async () => { await api('/score', 'POST', { childId: S.cid, ruleId: id }); toast(`${r.type === 'bad' ? '-' : '+'}${r.points}`); fly(rc, `${r.type === 'bad' ? '-' : '+'}${r.points} ${r.type === 'bad' ? '💔' : '⭐'}`, r.type === 'bad'); refresh(); }); }
    else if (a === 'manual') { const s = +t.dataset.s; modal(`<h3>手动${s > 0 ? '加' : '扣'}分</h3><input id="mp" type="number" inputmode="numeric" placeholder="分数"><input id="mr" placeholder="原因(可不填)">`, async () => { const n = Math.abs(+$('#mp').value | 0); if (!n) throw new Error('请输入分数'); await api('/score', 'POST', { childId: S.cid, delta: s * n, reason: $('#mr').value }); refresh(); }); }
    else if (a === 'redeem') { const i = S.shop.find(x => x.id === id); ask('兑换', `用 ${i.cost} 分兑换「${esc(i.name)}」?`, async () => { await api('/redeem', 'POST', { childId: S.cid, itemId: id }); toast('兑换成功 🎉'); refresh(); }); }
    else if (a === 'checkin') { const r = await api('/checkin', 'POST', { childId: S.cid }); toast(`打卡成功 +${r.got}`); refresh(); }
    else if (a === 'ftest') schedFocusNotice(Date.now() + 10000, true);
    else if (a === 'fsnd') { store.set('xt_fsnd', soundOn() ? '0' : '1'); if (soundOn()) { unlockAudio(); playAlarm(); } render(); }
    else if (a === 'fstart') { unlockAudio(); F.endAt = Date.now() + F.minutes * 60000; F.running = true; schedFocusNotice(); render(); }
    else if (a === 'fstop') ask('放弃专注?', '现在放弃就没有积分啦', async () => { F.running = false; cancelFocusNotice(); render(); });
    else if (a === 'ftask') { F.task = t.dataset.v; render(); }
    else if (a === 'fmin') modal(`<h3>专注时长</h3><div class="chips" style="justify-content:center;margin-bottom:6px">${[10, 15, 20, 30, 45, 60].map(m => `<button class="chip" data-a="setmin" data-v="${m}">${m} 分钟</button>`).join('')}</div><input id="cm" type="number" inputmode="numeric" min="1" max="180" placeholder="自定义分钟(1-180)" value="${F.minutes}">`, () => { const n = Math.round(+$('#cm').value); if (!(n >= 1 && n <= 180)) throw new Error('请输入 1-180 分钟'); F.minutes = n; store.set('xt_fmin', String(n)); render(); });
    else if (a === 'setmin') { F.minutes = +t.dataset.v; store.set('xt_fmin', String(F.minutes)); close(); render(); }
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
