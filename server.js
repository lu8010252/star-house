const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8020;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const PASSWORD = process.env.PASSWORD || '123456';
const TOKEN = crypto.createHash('sha256').update('xtd:' + PASSWORD).digest('hex');
const UPLOADS = path.join(DATA, 'uploads');
const DB_FILE = path.join(DATA, 'db.json');
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------- 数据 ----------
function defaults() {
  return {
    seq: 100,
    children: [],
    rules: [
      { id: 1, name: '作业A+', type: 'good', points: 10 },
      { id: 2, name: '阅读30分钟', type: 'good', points: 10 },
      { id: 3, name: '按时完成任务', type: 'good', points: 10 },
      { id: 4, name: '主动帮忙', type: 'good', points: 5 },
      { id: 5, name: '吃饭拖拉', type: 'bad', points: 10 },
      { id: 6, name: '任务超时', type: 'bad', points: 10 },
      { id: 7, name: '说脏话', type: 'bad', points: 5 },
    ],
    shop: [
      { id: 11, name: '看动画片30分钟', cost: 50 },
      { id: 12, name: '小零食一份', cost: 30 },
      { id: 13, name: '周末游乐场', cost: 200 },
      { id: 14, name: '新玩具', cost: 300 },
    ],
    logs: [], // {id,childId,delta,reason,type,ts,d}
    redeems: [], // {id,childId,name,cost,ts,d}
    checkins: [], // {childId,d}
    focus: [], // {id,childId,task,minutes,ts,d}
    study: [], // {id,childId,subject,kind,score,note,ts,d}
    claims: [], // 孩子申报 {id,childId,ruleId,name,points,ts,d,status:pending|ok|no}
    wishes: [], // 心愿 {id,childId,name,cost,icon,ts,status:open|done}
    audit: [], // 操作日志 {id,ts,from,act,text,undo?}
    meta: {},
    settings: { checkinPoints: 5, focusPer10: 2, focusTasks: ['吃饭', '阅读', '作业'], subjects: ['语文', '数学', '英语', '科学', '音乐', '美术', '体育'], kinds: ['作业', '单元卷', '月考卷', '期中卷', '期末卷'], ntfyUrl: '', ntfyToken: '', weeklyPush: true, streakRewards: [{ days: 3, points: 5 }, { days: 7, points: 20 }, { days: 14, points: 40 }, { days: 30, points: 100 }] },
  };
}
let db;
try { db = Object.assign(defaults(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch { db = defaults(); }
// 清理孤儿打卡:积分记录已被撤销、但打卡记录还在的(旧版撤销只回退积分)
db.checkins = db.checkins.filter(k => db.logs.some(l => l.type === 'checkin' && l.childId === k.childId && l.d === k.d));
db.settings = Object.assign(defaults().settings, db.settings); // 老数据补新设置项
const PRESET = { '路心语': '/avatars/girl-a.svg', '路依依': '/avatars/girl-b.svg' };
for (const c of db.children) if (!c.avatar && PRESET[c.name]) c.avatar = PRESET[c.name];
delete db.prizes; delete db.settings.lotteryCost; // 已移除抽奖功能
for (const r of db.redeems) if (r.done === undefined) r.done = true; // 老兑换记录视为已兑现
let saving = false, dirty = false;
function save() {
  if (saving) { dirty = true; return; }
  scheduleBackup();
  saving = true;
  const tmp = DB_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), err => {
    if (!err) fs.renameSync(tmp, DB_FILE);
    saving = false;
    if (dirty) { dirty = false; save(); }
  });
}
// ---------- 自动备份 ----------
const BAK = path.join(DATA, 'backups');
fs.mkdirSync(BAK, { recursive: true });
let bakTimer = null;
function writeBackup(name) {
  try { fs.writeFileSync(path.join(BAK, name), JSON.stringify(db)); } catch (e) { console.error('备份失败', e.message); }
}
function pruneBackups() {
  try {
    const f = fs.readdirSync(BAK).filter(x => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
    for (const x of f.slice(0, Math.max(0, f.length - 30))) fs.unlinkSync(path.join(BAK, x));
    for (const re of [/^db-manual-/, /^db-before-restore-/]) { // 手动/恢复前的副本各留最近 10 份
      const g = fs.readdirSync(BAK).filter(x => re.test(x)).sort();
      for (const x of g.slice(0, Math.max(0, g.length - 10))) fs.unlinkSync(path.join(BAK, x));
    }
  } catch {}
}
function scheduleBackup() { // 数据有变动 → 1 分钟后更新当天快照(合并频繁操作)
  if (bakTimer) return;
  bakTimer = setTimeout(() => { bakTimer = null; writeBackup(`db-${dstr()}.json`); pruneBackups(); }, 60000);
}
const pad = n => String(n).padStart(2, '0');
const dstr = (t = Date.now()) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const nid = () => ++db.seq;
const monday = () => dstr(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5); // 本周一(周一为一周开始)
const truthy = v => v === true || v === 'true' || v === 1 || v === '1';
const child = id => db.children.find(c => c.id === +id);
const sg = n => (n > 0 ? '+' : '') + n;
// 操作日志:undo 里放撤销所需的数据
function audit(act, text, undo) {
  db.audit.push({ id: nid(), ts: Date.now(), from: FROM, act, text, undo: undo || null });
  if (db.audit.length > 300) db.audit.splice(0, db.audit.length - 300);
}
// ntfy 推送(设置里填 https://ntfy.xxx/主题;也可用环境变量 NTFY_URL)
async function notify(title, message, tags) {
  const url = String(db.settings.ntfyUrl || process.env.NTFY_URL || '').trim();
  if (!url) return { ok: false, err: '还没填通知地址' };
  try {
    const u = new URL(url), topic = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!topic) return { ok: false, err: '地址里要带主题名,如 https://ntfy.xxx.com/notice' };
    const h = { 'Content-Type': 'application/json' };
    if (db.settings.ntfyToken) h.Authorization = 'Bearer ' + db.settings.ntfyToken;
    const r = await fetch(u.origin, { method: 'POST', headers: h, body: JSON.stringify({ topic, title, message, tags: tags || [] }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { ok: false, err: 'ntfy 返回 ' + r.status };
    return { ok: true };
  } catch (e) { console.error('ntfy 失败', e.message); return { ok: false, err: e.message }; }
}

let FROM = ''; // 本次请求来自:admin=家长后台,app=手机前台
function addLog(c, delta, reason, type) {
  c.points = (c.points || 0) + delta;
  const l = { id: nid(), childId: c.id, delta, reason, type, ts: Date.now(), d: dstr(), by: FROM };
  db.logs.push(l);
  return l;
}

// ---------- 服务 ----------
const app = express();
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  if (req.body && req.body.password === PASSWORD) return res.json({ token: TOKEN });
  res.status(401).json({ error: '密码不对' });
});
app.use('/api', (req, res, next) => {
  if (req.headers['x-token'] === TOKEN) { FROM = req.headers['x-from'] === 'admin' ? 'admin' : 'app'; return next(); }
  res.status(401).json({ error: '未登录' });
});
const wrap = fn => (req, res) => { try { res.json(fn(req, res) ?? { ok: true }); save(); } catch (e) { res.status(400).json({ error: e.message }); } };
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

app.get('/api/state', wrap(() => ({
  children: db.children, rules: db.rules, shop: db.shop,
  settings: { ...db.settings, ntfyToken: undefined, hasToken: !!db.settings.ntfyToken }, today: dstr(),
  claims: db.claims.filter(c => c.status === 'pending'), // 待家长确认的申报
  wishes: db.wishes.filter(w => w.status === 'open'),
  checkins: db.checkins.filter(c => c.d.slice(0, 7) >= dstr(Date.now() - 62 * 864e5).slice(0, 7)),
  wk: db.redeems.filter(r => r.d >= monday()).map(r => ({ childId: r.childId, itemId: r.itemId })), // 本周兑换次数(限兑用)
  rwk: db.logs.filter(l => l.type === 'rule' && l.d >= monday()).map(l => ({ childId: l.childId, name: l.reason, d: l.d })), // 本周规则次数(卡片徽标用)
  swk: db.study.filter(x => x.d >= monday()).map(x => x.childId), // 本周学习次数
})));

// 孩子
app.post('/api/children', wrap(req => {
  const name = String(req.body.name || '').trim(); need(name, '请填写名字');
  const c = { id: nid(), name, avatar: req.body.avatar || PRESET[name] || '', points: 0, created: Date.now() };
  db.children.push(c); return c;
}));
app.put('/api/children/:id', wrap(req => {
  const c = child(req.params.id); need(c, '孩子不存在');
  if (req.body.name != null) c.name = String(req.body.name).trim() || c.name;
  if (req.body.avatar != null) c.avatar = req.body.avatar;
  return c;
}));
const CHILD_RECS = ['logs', 'redeems', 'checkins', 'focus', 'study', 'claims', 'wishes'];
app.delete('/api/children/:id', wrap(req => {
  const id = +req.params.id, idx = db.children.findIndex(c => c.id === id), c = db.children[idx];
  need(c, '孩子不存在');
  const recs = {}; for (const k of CHILD_RECS) { recs[k] = db[k].filter(x => x.childId === id); db[k] = db[k].filter(x => x.childId !== id); }
  db.children.splice(idx, 1);
  audit('删除孩子', `${c.name}(${c.points || 0} 分,含全部记录)`, { kind: 'child', child: c, idx, recs });
}));

// 规则 / 商城 / 奖品 通用增删改
const colls = {
  rules: o => ({
    name: String(o.name || '').trim(), type: o.type === 'bad' ? 'bad' : 'good', points: Math.abs(+o.points || 0),
    icon: String(o.icon || '').trim().slice(0, 4), group: String(o.group || '').trim().slice(0, 10), off: truthy(o.off),
    kids: (Array.isArray(o.kids) ? o.kids : []).map(Number).filter(Boolean), // 空=所有孩子适用
  }),
  shop: o => ({
    name: String(o.name || '').trim(), cost: Math.abs(+o.cost || 0), icon: String(o.icon || '').trim().slice(0, 4),
    stock: o.stock === '' || o.stock == null ? null : Math.max(0, Math.trunc(+o.stock) || 0), // null=不限库存
    weekly: Math.max(0, Math.trunc(+o.weekly) || 0), // 每周每个孩子限兑次数,0=不限
  }),
};
// 排序:前端传完整 id 顺序(须在 /:id 路由之前注册)
for (const k of Object.keys(colls)) {
  app.put(`/api/${k}/order`, wrap(req => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [], pos = new Map(ids.map((id, i) => [id, i]));
    db[k].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e9) - (pos.has(b.id) ? pos.get(b.id) : 1e9));
  }));
}
for (const [k, norm] of Object.entries(colls)) {
  app.post(`/api/${k}`, wrap(req => { const o = norm(req.body); need(o.name, '请填写名称'); o.id = nid(); db[k].push(o); return o; }));
  app.put(`/api/${k}/:id`, wrap(req => {
    const i = db[k].findIndex(x => x.id === +req.params.id); need(i >= 0, '不存在');
    const o = norm({ ...db[k][i], ...req.body }); need(o.name, '请填写名称');
    db[k][i] = { ...o, id: db[k][i].id }; return db[k][i];
  }));
  app.delete(`/api/${k}/:id`, wrap(req => {
    const idx = db[k].findIndex(x => x.id === +req.params.id); if (idx < 0) return;
    const [o] = db[k].splice(idx, 1);
    audit(k === 'rules' ? '删除规则' : '删除商品', o.name, { kind: k, obj: o, idx });
  }));
}

// 加扣分(childIds 可批量)
app.post('/api/score', wrap(req => {
  const ids = Array.isArray(req.body.childIds) && req.body.childIds.length ? req.body.childIds : [req.body.childId];
  const kids = ids.map(id => { const c = child(id); need(c, '孩子不存在'); return c; });
  let r = null, delta = 0;
  if (req.body.ruleId) { r = db.rules.find(x => x.id === +req.body.ruleId); need(r, '规则不存在'); need(!r.off, '该规则已停用'); }
  else { delta = Math.trunc(+req.body.delta); need(delta, '分数不对'); }
  for (const c of kids) {
    if (r) addLog(c, r.type === 'bad' ? -r.points : r.points, r.name, 'rule');
    else addLog(c, delta, String(req.body.reason || (delta > 0 ? '手动加分' : '手动扣分')).slice(0, 40), 'manual');
  }
  return { points: kids[0].points };
}));

// 兑换(库存 / 每周限兑)
app.post('/api/redeem', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const it = db.shop.find(x => x.id === +req.body.itemId); need(it, '商品不存在');
  need(it.stock == null || it.stock > 0, '这个已经兑完啦');
  if (it.weekly > 0) need(db.redeems.filter(r => r.childId === c.id && r.itemId === it.id && r.d >= monday()).length < it.weekly, `这个本周最多兑 ${it.weekly} 次`);
  need(c.points >= it.cost, '积分不够哦');
  const rd = { id: nid(), childId: c.id, itemId: it.id, name: it.name, cost: it.cost, ts: Date.now(), d: dstr(), done: false };
  const l = addLog(c, -it.cost, '兑换:' + it.name, 'redeem'); l.ref = rd.id;
  db.redeems.push(rd);
  if (it.stock != null) it.stock--;
  notify('🛍 星星屋:有兑换申请', `${c.name} 兑换了「${it.name}」(-${it.cost} 分,剩 ${c.points} 分),记得兑现哦`, ['gift']);
  return { points: c.points, name: it.name };
}));
app.put('/api/redeems/:id', wrap(req => { // 标记已兑现(奖励已发给孩子)
  const r = db.redeems.find(x => x.id === +req.params.id); need(r, '记录不存在');
  r.done = req.body.done !== false; return r;
}));

// 打卡(连续天数奖励:恰好达到设定天数时发一次)
function streakOf(cid, d) {
  const set = new Set(db.checkins.filter(x => x.childId === cid).map(x => x.d));
  let n = 0, t = new Date(d + 'T12:00:00').getTime();
  while (set.has(dstr(t))) { n++; t -= 864e5; }
  return n;
}
app.post('/api/checkin', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const d = dstr();
  need(!db.checkins.some(x => x.childId === c.id && x.d === d), '今天已经打过卡啦');
  db.checkins.push({ childId: c.id, d });
  addLog(c, db.settings.checkinPoints, '每日打卡', 'checkin');
  const days = streakOf(c.id, d), hit = (db.settings.streakRewards || []).find(x => x.days === days);
  let bonus = 0;
  if (hit) { bonus = hit.points; addLog(c, bonus, `连续打卡 ${days} 天奖励`, 'streak'); }
  return { points: c.points, got: db.settings.checkinPoints, bonus, days };
}));

// 专注
app.post('/api/focus', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const minutes = Math.round(+req.body.minutes); need(minutes >= 1, '时间太短');
  const task = String(req.body.task || '专注').slice(0, 20);
  db.focus.push({ id: nid(), childId: c.id, task, minutes, ts: Date.now(), d: dstr() });
  const got = Math.floor(minutes / 10) * db.settings.focusPer10;
  if (got) addLog(c, got, `专注:${task} ${minutes}分钟`, 'focus');
  return { points: c.points, got };
}));

// 记录
app.get('/api/logs', wrap(req => {
  const { childId, type, limit } = req.query;
  let l = db.logs;
  if (childId) l = l.filter(x => x.childId === +childId);
  const { from, to, kind } = req.query;
  if (type === 'redeem' || kind === 'redeem') l = l.filter(x => x.type === 'redeem');
  else if (kind === 'gain') l = l.filter(x => x.delta > 0 && x.type !== 'redeem');
  else if (kind === 'loss') l = l.filter(x => x.delta < 0 && x.type !== 'redeem');
  if (from) l = l.filter(x => x.d >= from);
  if (to) l = l.filter(x => x.d <= to);
  return l.slice(-(+limit || 100)).reverse();
}));
app.delete('/api/logs/:id', wrap(req => { // 撤销一条记录并回退积分
  const i = db.logs.findIndex(x => x.id === +req.params.id); need(i >= 0, '记录不存在');
  const l = db.logs[i], c = child(l.childId);
  if (c) c.points -= l.delta;
  if (l.ref) { // 撤销兑换:删兑换记录并恢复库存
    const ri = db.redeems.findIndex(x => x.id === l.ref);
    if (ri >= 0) { const it = db.shop.find(x => x.id === db.redeems[ri].itemId); if (it && it.stock != null) it.stock++; db.redeems.splice(ri, 1); }
  }
  if (l.type === 'checkin') { // 撤销打卡:同时清掉打卡次数和当天发的连续奖励
    db.checkins = db.checkins.filter(k => !(k.childId === l.childId && k.d === l.d));
    const bs = db.logs.filter(x => x.type === 'streak' && x.childId === l.childId && x.d === l.d);
    if (c) for (const b of bs) c.points -= b.delta;
    db.logs = db.logs.filter(x => !bs.includes(x));
  }
  db.logs = db.logs.filter(x => x !== l);
  return;
}));
app.get('/api/focus', wrap(req => db.focus.filter(x => !req.query.childId || x.childId === +req.query.childId).slice(-100).reverse()));

// 学习记录
app.post('/api/study', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const subject = String(req.body.subject || '').trim().slice(0, 10), kind = String(req.body.kind || '').trim().slice(0, 10);
  need(subject && kind, '请选择科目和类型');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(req.body.d) ? req.body.d : dstr();
  const r = { id: nid(), childId: c.id, subject, kind, score: String(req.body.score || '').trim().slice(0, 10), note: String(req.body.note || '').trim().slice(0, 200), ts: Date.now(), d };
  db.study.push(r); return r;
}));
app.get('/api/study', wrap(req => {
  const { childId, subject, kind } = req.query;
  return db.study.filter(x => (!childId || x.childId === +childId) && (!subject || x.subject === subject) && (!kind || x.kind === kind))
    .sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id).slice(0, 200);
}));
app.delete('/api/study/:id', wrap(req => { db.study = db.study.filter(x => x.id !== +req.params.id); }));

// 时光日历:月度每日概览 / 单日详情
app.get('/api/calendar', wrap(req => {
  const c = child(req.query.childId); need(c, '孩子不存在');
  const m = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : dstr().slice(0, 7);
  const days = {}, at = d => days[d] || (days[d] = { net: 0, checkin: false, study: 0, focus: 0 });
  for (const l of db.logs) if (l.childId === c.id && l.d.startsWith(m) && l.type !== 'redeem') at(l.d).net += l.delta;
  for (const x of db.checkins) if (x.childId === c.id && x.d.startsWith(m)) at(x.d).checkin = true;
  for (const x of db.study) if (x.childId === c.id && x.d.startsWith(m)) at(x.d).study++;
  for (const x of db.focus) if (x.childId === c.id && x.d.startsWith(m)) at(x.d).focus += x.minutes;
  return { month: m, days };
}));
app.get('/api/day', wrap(req => {
  const c = child(req.query.childId); need(c, '孩子不存在');
  const d = String(req.query.d || '');
  return {
    logs: db.logs.filter(x => x.childId === c.id && x.d === d), study: db.study.filter(x => x.childId === c.id && x.d === d),
    focus: db.focus.filter(x => x.childId === c.id && x.d === d), checkin: db.checkins.some(x => x.childId === c.id && x.d === d),
  };
}));

// 今日概览:每个孩子今日得失/打卡,以及待兑现的奖励
app.get('/api/today', wrap(() => {
  const d = dstr();
  return {
    d,
    kids: db.children.map(c => {
      let gain = 0, loss = 0;
      for (const l of db.logs) if (l.childId === c.id && l.d === d && l.type !== 'redeem') { if (l.delta > 0) gain += l.delta; else loss -= l.delta; }
      return { id: c.id, name: c.name, points: c.points || 0, gain, loss, checked: db.checkins.some(x => x.childId === c.id && x.d === d) };
    }),
    pending: db.redeems.filter(r => !r.done).sort((a, b) => b.ts - a.ts).slice(0, 30).map(r => ({ ...r, child: child(r.childId)?.name || '' })),
  };
}));

// 备份:导出 / 导入整库(头像图片文件在 uploads 目录,需另行备份)
app.get('/api/export', wrap(() => db));
function applyDb(o) {
  need(o && Array.isArray(o.children) && Array.isArray(o.rules) && Array.isArray(o.logs), '备份文件格式不对');
  writeBackup(`db-before-restore-${Date.now()}.json`); // 覆盖前先留一份当前数据
  const n = Object.assign(defaults(), o); n.settings = Object.assign(defaults().settings, o.settings);
  const mx = Math.max(100, ...['children', 'rules', 'shop', 'logs', 'redeems', 'focus', 'study', 'claims', 'wishes', 'audit'].flatMap(k => (n[k] || []).map(x => +x.id || 0)));
  n.seq = Math.max(+n.seq || 0, mx);
  for (const r of n.redeems || []) if (r.done === undefined) r.done = true;
  db = n;
  audit('导入/恢复数据', '整库已被替换(替换前自动留了一份副本)');
}
app.post('/api/import', wrap(req => { applyDb(req.body && req.body.db); }));

// 自动备份列表 / 立即备份 / 下载 / 恢复
const bakName = n => { need(/^db-[\w-]+\.json$/.test(n), '备份名不对'); return n; };
app.get('/api/backups', wrap(() => fs.readdirSync(BAK).filter(x => /^db-[\w-]+\.json$/.test(x)).map(x => { const st = fs.statSync(path.join(BAK, x)); return { name: x, size: st.size, ts: st.mtimeMs }; }).sort((a, b) => b.ts - a.ts)));
app.post('/api/backups', wrap(() => { const n = `db-manual-${Date.now()}.json`; writeBackup(n); return { name: n }; }));
app.get('/api/backups/:name', wrap(req => JSON.parse(fs.readFileSync(path.join(BAK, bakName(req.params.name)), 'utf8'))));
app.post('/api/backups/:name/restore', wrap(req => { applyDb(JSON.parse(fs.readFileSync(path.join(BAK, bakName(req.params.name)), 'utf8'))); }));

// ---------- 孩子申报(孩子点「我做到了」,家长确认后才加分) ----------
app.post('/api/claims', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const r = db.rules.find(x => x.id === +req.body.ruleId); need(r && r.type === 'good' && !r.off, '这条规则不能申报');
  need(!db.claims.some(x => x.status === 'pending' && x.childId === c.id && x.ruleId === r.id), '已经申报过啦,等爸爸妈妈确认~');
  const cl = { id: nid(), childId: c.id, ruleId: r.id, name: r.name, points: r.points, icon: r.icon || '', ts: Date.now(), d: dstr(), status: 'pending' };
  db.claims.push(cl);
  const done = db.claims.filter(x => x.status !== 'pending'); // 已处理的只留最近 200 条
  if (done.length > 200) { const del = new Set(done.slice(0, done.length - 200)); db.claims = db.claims.filter(x => !del.has(x)); }
  notify('🙋 星星屋:有新申报', `${c.name} 说做到了「${r.name}」(+${r.points} 分),等你确认`, ['raising_hand']);
  return cl;
}));
app.post('/api/claims/:id/approve', wrap(req => {
  const cl = db.claims.find(x => x.id === +req.params.id); need(cl, '申报不存在'); need(cl.status === 'pending', '这条已经处理过了');
  const c = child(cl.childId); need(c, '孩子不存在');
  const l = addLog(c, cl.points, cl.name, 'rule'); l.claim = cl.id;
  cl.status = 'ok'; cl.logId = l.id; cl.hts = Date.now();
  return { points: c.points };
}));
app.post('/api/claims/:id/reject', wrap(req => {
  const cl = db.claims.find(x => x.id === +req.params.id); need(cl, '申报不存在'); need(cl.status === 'pending', '这条已经处理过了');
  cl.status = 'no'; cl.hts = Date.now();
  audit('驳回申报', `${child(cl.childId)?.name || ''} · ${cl.name}`, { kind: 'claim', id: cl.id });
}));

// ---------- 心愿清单 ----------
app.post('/api/wishes', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const name = String(req.body.name || '').trim().slice(0, 30); need(name, '写一下你的心愿吧');
  const cost = Math.min(99999, Math.max(1, Math.trunc(+req.body.cost) || 0)); need(cost >= 1, '想要多少颗星星?');
  const w = { id: nid(), childId: c.id, name, cost, icon: String(req.body.icon || '').trim().slice(0, 4), ts: Date.now(), status: 'open' };
  db.wishes.push(w);
  notify('🌠 星星屋:新心愿', `${c.name} 许了个愿:「${name}」(想要 ${cost} 颗星)`, ['sparkles']);
  return w;
}));
app.put('/api/wishes/:id', wrap(req => {
  const w = db.wishes.find(x => x.id === +req.params.id); need(w, '心愿不存在');
  if (req.body.name != null) w.name = String(req.body.name).trim().slice(0, 30) || w.name;
  if (req.body.cost != null) w.cost = Math.min(99999, Math.max(1, Math.trunc(+req.body.cost) || w.cost));
  return w;
}));
app.delete('/api/wishes/:id', wrap(req => { db.wishes = db.wishes.filter(x => x.id !== +req.params.id); }));
app.post('/api/wishes/:id/toshop', wrap(req => { // 家长同意:变成商城里的一件商品(库存 1)
  const w = db.wishes.find(x => x.id === +req.params.id); need(w && w.status === 'open', '心愿不存在');
  const it = { id: nid(), name: w.name, cost: w.cost, icon: w.icon || '🌠', stock: 1, weekly: 0 };
  db.shop.push(it); w.status = 'done';
  return it;
}));

// ---------- 操作日志 / 撤销 ----------
app.get('/api/audit', wrap(() => db.audit.slice(-150).reverse().map(a => ({ id: a.id, ts: a.ts, from: a.from, act: a.act, text: a.text, undo: !!a.undo, undone: !!a.undone }))));
app.post('/api/audit/:id/undo', wrap(req => {
  const a = db.audit.find(x => x.id === +req.params.id); need(a && a.undo, '这条不能撤销');
  const u = a.undo;
  if (u.kind === 'rules' || u.kind === 'shop') {
    need(!db[u.kind].some(x => x.id === u.obj.id), '已经恢复过了');
    db[u.kind].splice(Math.min(u.idx, db[u.kind].length), 0, u.obj);
  } else if (u.kind === 'child') {
    need(!child(u.child.id), '这个孩子已经在了');
    db.children.splice(Math.min(u.idx, db.children.length), 0, u.child);
    for (const k of CHILD_RECS) { db[k].push(...(u.recs[k] || [])); if (k !== 'checkins') db[k].sort((x, y) => (x.ts || 0) - (y.ts || 0)); }
  } else if (u.kind === 'claim') {
    const cl = db.claims.find(x => x.id === u.id); need(cl && cl.status === 'no', '申报状态变了');
    cl.status = 'pending';
  }
  a.undone = true; a.undo = null;
}));

// ---------- 周报 / 月报 ----------
const addDays = (d, n) => dstr(new Date(d + 'T12:00:00').getTime() + n * 864e5);
function periodRange(type, off) {
  if (type === 'month') {
    const t = new Date(), x = new Date(t.getFullYear(), t.getMonth() + off, 1), m = `${x.getFullYear()}-${pad(x.getMonth() + 1)}`, n = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    return { from: m + '-01', to: `${m}-${pad(n)}`, label: `${x.getFullYear()}年${x.getMonth() + 1}月`, n };
  }
  const mon = addDays(monday(), off * 7);
  return { from: mon, to: addDays(mon, 6), label: `${mon.slice(5)} ~ ${addDays(mon, 6).slice(5)}`, n: 7 };
}
function summ(cid, r) {
  const inr = d => d >= r.from && d <= r.to, t0 = new Date(r.from + 'T12:00:00').getTime();
  let gain = 0, loss = 0, rc = 0, rn = 0; const gr = {}, lr = {}, daily = Array(r.n).fill(0);
  for (const l of db.logs) {
    if (l.childId !== cid || !inr(l.d)) continue;
    if (l.type === 'redeem') { rc += -l.delta; rn++; continue; }
    const i = Math.round((new Date(l.d + 'T12:00:00').getTime() - t0) / 864e5); if (i >= 0 && i < r.n) daily[i] += l.delta;
    if (l.delta > 0) { gain += l.delta; gr[l.reason] = (gr[l.reason] || 0) + l.delta; } else if (l.delta < 0) { loss += -l.delta; lr[l.reason] = (lr[l.reason] || 0) + -l.delta; }
  }
  const top = m => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    gain, loss, net: gain - loss, daily, topGain: top(gr), topLoss: top(lr), redeemN: rn, redeemCost: rc,
    checkins: db.checkins.filter(x => x.childId === cid && inr(x.d)).length,
    focusMin: db.focus.filter(x => x.childId === cid && inr(x.d)).reduce((a, x) => a + x.minutes, 0),
    study: db.study.filter(x => x.childId === cid && inr(x.d)).length,
  };
}
function reportText(c, type, off) {
  const r = periodRange(type, off), s = summ(c.id, r), p = summ(c.id, periodRange(type, off - 1)), tn = type === 'month' ? '月' : '周';
  return [`📊 ${c.name} ${type === 'month' ? '月报' : '周报'}(${r.label})`, `净得分 ${sg(s.net)}(加 ${s.gain} / 扣 ${s.loss}),较上${tn} ${sg(s.net - p.net)}`,
    `打卡 ${s.checkins}/${r.n} 天 · 专注 ${s.focusMin} 分钟 · 学习记录 ${s.study} 条`,
    s.topGain.length ? `最多加分:${s.topGain.map(([k, v]) => `${k} +${v}`).join('、')}` : '', s.topLoss.length ? `需要留意:${s.topLoss.map(([k, v]) => `${k} -${v}`).join('、')}` : '',
    s.redeemN ? `兑换 ${s.redeemN} 次,花 ${s.redeemCost} 分` : '', `当前积分 ⭐ ${c.points || 0}`].filter(Boolean).join('\n');
}
app.get('/api/report', wrap(req => {
  const c = child(req.query.childId); need(c, '孩子不存在');
  const type = req.query.type === 'month' ? 'month' : 'week', off = Math.min(0, Math.trunc(+req.query.offset) || 0);
  const r = periodRange(type, off);
  return {
    type, offset: off, range: r, name: c.name, points: c.points || 0, cur: summ(c.id, r), prev: summ(c.id, periodRange(type, off - 1)),
    sibs: db.children.map(k => { const x = summ(k.id, r); return { id: k.id, name: k.name, net: x.net, gain: x.gain, loss: x.loss, checkins: x.checkins, focusMin: x.focusMin }; }),
    text: reportText(c, type, off),
  };
}));
// 每周日 20:00 把全家周报推到 ntfy
setInterval(() => {
  const n = new Date();
  if (n.getDay() !== 0 || n.getHours() !== 20 || db.meta.weekPush === dstr() || !db.children.length) return;
  db.meta.weekPush = dstr(); save();
  if (db.settings.weeklyPush) notify('⭐ 星星屋本周周报', db.children.map(c => reportText(c, 'week', 0)).join('\n\n'), ['star']);
}, 60000);

// 通知测试
app.post('/api/notify/test', async (req, res) => {
  const r = await notify('⭐ 星星屋', '这是一条测试通知,收到就说明设置成功啦', ['tada']);
  r.ok ? res.json({ ok: true }) : res.status(400).json({ error: r.err });
});

// 月度统计
app.get('/api/stats', wrap(req => {
  const c = child(req.query.childId); need(c, '孩子不存在');
  const m = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : dstr().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const pm = mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`;
  const one = month => {
    const [yy, mm] = month.split('-').map(Number), days = new Date(yy, mm, 0).getDate();
    const daily = Array(days).fill(0); let gain = 0, loss = 0; const gr = {}, lr = {};
    for (const l of db.logs) {
      if (l.childId !== c.id || l.d.slice(0, 7) !== month || l.type === 'redeem') continue;
      daily[+l.d.slice(8) - 1] += l.delta;
      if (l.delta > 0) { gain += l.delta; gr[l.reason] = (gr[l.reason] || 0) + l.delta; }
      else if (l.delta < 0) { loss += -l.delta; lr[l.reason] = (lr[l.reason] || 0) + -l.delta; }
    }
    return { month, daily, gain, loss, net: gain - loss, gainBy: gr, lossBy: lr };
  };
  return { cur: one(m), prev: one(pm) };
}));

app.put('/api/settings', wrap(req => {
  const s = db.settings, b = req.body;
  if (b.checkinPoints != null) s.checkinPoints = Math.max(0, +b.checkinPoints | 0);
  if (b.focusPer10 != null) s.focusPer10 = Math.max(0, +b.focusPer10 | 0);
  if (b.ntfyUrl != null) s.ntfyUrl = String(b.ntfyUrl).trim().slice(0, 200);
  if (b.ntfyToken) s.ntfyToken = String(b.ntfyToken).trim().slice(0, 200); // 留空=不改
  if (b.clearToken) s.ntfyToken = '';
  if (b.weeklyPush != null) s.weeklyPush = truthy(b.weeklyPush);
  if (b.streakRewards != null) {
    const arr = Array.isArray(b.streakRewards) ? b.streakRewards : String(b.streakRewards).split(/[,，、;；\s]+/).filter(Boolean).map(x => { const [d, p] = x.split(/[:：]/); return { days: +d, points: +p }; });
    s.streakRewards = arr.map(x => ({ days: Math.trunc(+x.days), points: Math.trunc(+x.points) })).filter(x => x.days >= 2 && x.days <= 365 && x.points > 0).sort((a, c) => a.days - c.days).slice(0, 10);
  }
  for (const k of ['focusTasks', 'subjects', 'kinds']) if (Array.isArray(b[k])) s[k] = b[k].map(x => String(x).trim()).filter(Boolean).slice(0, 16);
  return s;
}));

// 图片上传(头像/形象图):{data:'data:image/jpeg;base64,...'}
app.post('/api/upload', wrap(req => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(req.body.data || ''); need(m, '图片格式不对');
  const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64'));
  return { url: '/uploads/' + name };
}));

writeBackup(`db-${dstr()}.json`); pruneBackups();
app.listen(PORT, () => console.log('星星屋 running on :' + PORT));
