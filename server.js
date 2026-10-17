const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
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
    prizes: [
      { id: 21, name: '谢谢参与,再接再厉', weight: 30, bonus: 0 },
      { id: 22, name: '+10 积分', weight: 30, bonus: 10 },
      { id: 23, name: '+20 积分', weight: 15, bonus: 20 },
      { id: 24, name: '小贴纸一张', weight: 15, bonus: 0 },
      { id: 25, name: '冰淇淋一个', weight: 10, bonus: 0 },
    ],
    logs: [], // {id,childId,delta,reason,type,ts,d}
    redeems: [], // {id,childId,name,cost,ts,d}
    checkins: [], // {childId,d}
    focus: [], // {id,childId,task,minutes,ts,d}
    settings: { checkinPoints: 5, lotteryCost: 20, focusPer10: 2, focusTasks: ['吃饭', '阅读', '作业'] },
  };
}
let db;
try { db = Object.assign(defaults(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch { db = defaults(); }
let saving = false, dirty = false;
function save() {
  if (saving) { dirty = true; return; }
  saving = true;
  const tmp = DB_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), err => {
    if (!err) fs.renameSync(tmp, DB_FILE);
    saving = false;
    if (dirty) { dirty = false; save(); }
  });
}
const pad = n => String(n).padStart(2, '0');
const dstr = (t = Date.now()) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const nid = () => ++db.seq;
const child = id => db.children.find(c => c.id === +id);

function addLog(c, delta, reason, type) {
  c.points = (c.points || 0) + delta;
  const l = { id: nid(), childId: c.id, delta, reason, type, ts: Date.now(), d: dstr() };
  db.logs.push(l);
  return l;
}

// ---------- 服务 ----------
const app = express();
app.use(express.json({ limit: '8mb' }));
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
  children: db.children, rules: db.rules, shop: db.shop, prizes: db.prizes,
  settings: db.settings, today: dstr(),
  checkins: db.checkins.filter(c => c.d.slice(0, 7) >= dstr(Date.now() - 62 * 864e5).slice(0, 7)),
})));

// 孩子
app.post('/api/children', wrap(req => {
  const name = String(req.body.name || '').trim(); need(name, '请填写名字');
  const c = { id: nid(), name, avatar: req.body.avatar || '', points: 0, created: Date.now() };
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
  for (const k of ['logs', 'redeems', 'checkins', 'focus']) db[k] = db[k].filter(x => x.childId !== id);
}));

// 规则 / 商城 / 奖品 通用增删改
const colls = {
  rules: o => ({ name: String(o.name || '').trim(), type: o.type === 'bad' ? 'bad' : 'good', points: Math.abs(+o.points || 0) }),
  shop: o => ({ name: String(o.name || '').trim(), cost: Math.abs(+o.cost || 0) }),
  prizes: o => ({ name: String(o.name || '').trim(), weight: Math.abs(+o.weight || 0), bonus: Math.abs(+o.bonus || 0) }),
};
for (const [k, norm] of Object.entries(colls)) {
  app.post(`/api/${k}`, wrap(req => { const o = norm(req.body); need(o.name, '请填写名称'); o.id = nid(); db[k].push(o); return o; }));
  app.put(`/api/${k}/:id`, wrap(req => {
    const i = db[k].findIndex(x => x.id === +req.params.id); need(i >= 0, '不存在');
    const o = norm({ ...db[k][i], ...req.body }); need(o.name, '请填写名称');
    db[k][i] = { ...o, id: db[k][i].id }; return db[k][i];
  }));
  app.delete(`/api/${k}/:id`, wrap(req => { db[k] = db[k].filter(x => x.id !== +req.params.id); }));
}

// 加扣分
app.post('/api/score', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  if (req.body.ruleId) {
    const r = db.rules.find(x => x.id === +req.body.ruleId); need(r, '规则不存在');
    addLog(c, r.type === 'bad' ? -r.points : r.points, r.name, 'rule');
  } else {
    const delta = Math.trunc(+req.body.delta); need(delta, '分数不对');
    addLog(c, delta, String(req.body.reason || (delta > 0 ? '手动加分' : '手动扣分')).slice(0, 40), 'manual');
  }
  return { points: c.points };
}));

// 兑换
app.post('/api/redeem', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const it = db.shop.find(x => x.id === +req.body.itemId); need(it, '商品不存在');
  need(c.points >= it.cost, '积分不够哦');
  addLog(c, -it.cost, '兑换:' + it.name, 'redeem');
  db.redeems.push({ id: nid(), childId: c.id, name: it.name, cost: it.cost, ts: Date.now(), d: dstr() });
  return { points: c.points, name: it.name };
}));

// 抽奖
app.post('/api/lottery', wrap(req => {
  const c = child(req.body.childId); need(c, '孩子不存在');
  const cost = db.settings.lotteryCost;
  need(c.points >= cost, '积分不够哦');
  need(db.prizes.length, '还没设置奖品');
  addLog(c, -cost, '抽奖消耗', 'lottery');
  let total = db.prizes.reduce((s, p) => s + p.weight, 0), r = Math.random() * total, hit = db.prizes[db.prizes.length - 1];
  for (const p of db.prizes) { if ((r -= p.weight) < 0) { hit = p; break; } }
  if (hit.bonus) addLog(c, hit.bonus, '抽中:' + hit.name, 'lottery');
  else db.logs.push({ id: nid(), childId: c.id, delta: 0, reason: '抽中:' + hit.name, type: 'lottery', ts: Date.now(), d: dstr() });
  return { points: c.points, prize: hit.name };
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
  if (type === 'redeem') l = l.filter(x => x.type === 'redeem');
  else if (type === 'lottery') l = l.filter(x => x.type === 'lottery');
  return l.slice(-(+limit || 100)).reverse();
}));
app.delete('/api/logs/:id', wrap(req => { // 撤销一条记录并回退积分
  const i = db.logs.findIndex(x => x.id === +req.params.id); need(i >= 0, '记录不存在');
  const l = db.logs[i], c = child(l.childId);
  if (c) c.points -= l.delta;
  db.logs.splice(i, 1);
}));
app.get('/api/focus', wrap(req => db.focus.filter(x => !req.query.childId || x.childId === +req.query.childId).slice(-100).reverse()));

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
      if (l.childId !== c.id || l.d.slice(0, 7) !== month || l.type === 'redeem' || l.type === 'lottery') continue;
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
  if (b.lotteryCost != null) s.lotteryCost = Math.max(0, +b.lotteryCost | 0);
  if (b.focusPer10 != null) s.focusPer10 = Math.max(0, +b.focusPer10 | 0);
  if (Array.isArray(b.focusTasks)) s.focusTasks = b.focusTasks.map(x => String(x).trim()).filter(Boolean).slice(0, 12);
  return s;
}));

// 图片上传(头像/形象图):{data:'data:image/jpeg;base64,...'}
app.post('/api/upload', wrap(req => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(req.body.data || ''); need(m, '图片格式不对');
  const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64'));
  return { url: '/uploads/' + name };
}));

app.listen(PORT, () => console.log('星糖日记 running on :' + PORT));
