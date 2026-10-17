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
    settings: { checkinPoints: 5, focusPer10: 2, focusTasks: ['吃饭', '阅读', '作业'], subjects: ['语文', '数学', '英语', '科学', '音乐', '美术', '体育'], kinds: ['作业', '单元卷', '月考卷', '期中卷', '期末卷'] },
  };
}
let db;
try { db = Object.assign(defaults(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch { db = defaults(); }
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

function addLog(c, delta, reason, type) {
  c.points = (c.points || 0) + delta;
  const l = { id: nid(), childId: c.id, delta, reason, type, ts: Date.now(), d: dstr() };
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
  if (req.headers['x-token'] === TOKEN) return next();
  res.status(401).json({ error: '未登录' });
});
const wrap = fn => (req, res) => { try { res.json(fn(req, res) ?? { ok: true }); save(); } catch (e) { res.status(400).json({ error: e.message }); } };
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

app.get('/api/state', wrap(() => ({
  children: db.children, rules: db.rules, shop: db.shop,
  settings: db.settings, today: dstr(),
  checkins: db.checkins.filter(c => c.d.slice(0, 7) >= dstr(Date.now() - 62 * 864e5).slice(0, 7)),
  wk: db.redeems.filter(r => r.d >= monday()).map(r => ({ childId: r.childId, itemId: r.itemId })), // 本周兑换次数(限兑用)
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
app.delete('/api/children/:id', wrap(req => {
  const id = +req.params.id;
  db.children = db.children.filter(c => c.id !== id);
  for (const k of ['logs', 'redeems', 'checkins', 'focus', 'study']) db[k] = db[k].filter(x => x.childId !== id);
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
  app.delete(`/api/${k}/:id`, wrap(req => { db[k] = db[k].filter(x => x.id !== +req.params.id); }));
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
  return { points: c.points, name: it.name };
}));
app.put('/api/redeems/:id', wrap(req => { // 标记已兑现(奖励已发给孩子)
  const r = db.redeems.find(x => x.id === +req.params.id); need(r, '记录不存在');
  r.done = req.body.done !== false; return r;
}));

// 打卡
app.post('/api/checkin', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const d = dstr();
  need(!db.checkins.some(x => x.childId === c.id && x.d === d), '今天已经打过卡啦');
  db.checkins.push({ childId: c.id, d });
  addLog(c, db.settings.checkinPoints, '每日打卡', 'checkin');
  return { points: c.points, got: db.settings.checkinPoints };
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
  db.logs.splice(i, 1);
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
  const mx = Math.max(100, ...['children', 'rules', 'shop', 'logs', 'redeems', 'focus', 'study'].flatMap(k => (n[k] || []).map(x => +x.id || 0)));
  n.seq = Math.max(+n.seq || 0, mx);
  for (const r of n.redeems || []) if (r.done === undefined) r.done = true;
  db = n;
}
app.post('/api/import', wrap(req => { applyDb(req.body && req.body.db); }));

// 自动备份列表 / 立即备份 / 下载 / 恢复
const bakName = n => { need(/^db-[\w-]+\.json$/.test(n), '备份名不对'); return n; };
app.get('/api/backups', wrap(() => fs.readdirSync(BAK).filter(x => /^db-[\w-]+\.json$/.test(x)).map(x => { const st = fs.statSync(path.join(BAK, x)); return { name: x, size: st.size, ts: st.mtimeMs }; }).sort((a, b) => b.ts - a.ts)));
app.post('/api/backups', wrap(() => { const n = `db-manual-${Date.now()}.json`; writeBackup(n); return { name: n }; }));
app.get('/api/backups/:name', wrap(req => JSON.parse(fs.readFileSync(path.join(BAK, bakName(req.params.name)), 'utf8'))));
app.post('/api/backups/:name/restore', wrap(req => { applyDb(JSON.parse(fs.readFileSync(path.join(BAK, bakName(req.params.name)), 'utf8'))); }));

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
