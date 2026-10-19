// 公共:接口、登录、提示、小工具
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-token': store.get('xt_token') || '', 'x-from': window.APP_FROM || 'app' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/login') { store.del('xt_token'); location.reload(); throw new Error('请重新登录'); }
  if (!r.ok) throw new Error(j.error || '出错了');
  return j;
}

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// 图片压缩后上传,返回 url
function pickImage(maxSize = 640) {
  return new Promise((resolve, reject) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => {
      const f = i.files[0]; if (!f) return reject(new Error('未选择'));
      const img = new Image(), u = URL.createObjectURL(f);
      img.onload = async () => {
        const k = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        try { resolve((await api('/upload', 'POST', { data: c.toDataURL('image/jpeg', .85) })).url); } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('图片读取失败'));
      img.src = u;
    };
    i.click();
  });
}

// 登录门:未登录时显示密码框,成功后回调
function requireLogin(title, onOk) {
  if (store.get('xt_token')) return onOk();
  const box = document.createElement('div');
  box.className = 'login';
  box.innerHTML = `<div class="login-card"><div class="login-logo">⭐</div><h2>${esc(title)}</h2>
    <input id="pw" type="password" placeholder="输入家庭密码" autocomplete="current-password"><button id="go">进入</button></div>`;
  document.body.appendChild(box);
  const go = async () => {
    try { const j = await api('/login', 'POST', { password: $('#pw').value }); store.set('xt_token', j.token); box.remove(); onOk(); }
    catch (e) { toast(e.message); }
  };
  $('#go').onclick = go; $('#pw').onkeydown = e => e.key === 'Enter' && go();
}

const fmtTime = ts => { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const sign = n => (n > 0 ? '+' : '') + n;

// 周报/月报(手机前台和家长后台共用)。R 是 /api/report 的返回
function reportHtml(R, o = {}) {
  const c = R.cur, p = R.prev, tn = R.type === 'month' ? '月' : '周', d = c.net - p.net;
  const mx = Math.max(1, ...c.daily.map(Math.abs));
  const lab = i => R.type === 'month' ? (i % 5 === 0 ? i + 1 : '') : '一二三四五六日'[i];
  const bars = c.daily.map((v, i) => `<div class="rb"><i class="${v < 0 ? 'n' : 'p'}" style="height:${v ? Math.max(6, Math.abs(v) / mx * 70) : 2}px" title="${v}"></i><em>${lab(i)}</em></div>`).join('');
  const top = (arr, cls) => arr.map(([k, v]) => `<div class="rr"><span>${esc(k)}</span><b class="${cls}">${cls === 'p' ? '+' : '-'}${v}</b></div>`).join('') || '<div class="rr none">暂无</div>';
  const smx = Math.max(1, ...R.sibs.map(x => Math.abs(x.net)));
  const sibs = o.sibs !== false && R.sibs.length > 1 ? `<div class="rbox"><h4>👭 姐妹对比 <small>净得分</small></h4>${R.sibs.map(x => `<div class="rr2"><span>${esc(x.name)}</span><div class="t"><i class="${x.net < 0 ? 'n' : ''}" style="width:${Math.max(3, Math.abs(x.net) / smx * 100)}%"></i></div><b class="${x.net >= 0 ? 'p' : 'n'}">${sign(x.net)}</b></div>`).join('')}</div>` : '';
  return `<div class="rp"><div class="rhead"><small>${esc(R.range.label)} · ${esc(R.name)}</small><b class="${c.net >= 0 ? 'p' : 'n'}">${sign(c.net)}</b><span>净得分(加 ${c.gain} / 扣 ${c.loss}) · 较上${tn} ${sign(d)}</span></div>
    <div class="rgrid"><div><b>${c.checkins}/${R.range.n}</b><small>打卡天数</small></div><div><b>${c.focusMin}</b><small>专注分钟</small></div><div><b>${c.study}</b><small>学习记录</small></div><div><b>${c.redeemN}</b><small>兑换次数</small></div></div>
    <div class="rbox"><h4>📅 每日净得分</h4><div class="rbars">${bars}</div></div>
    <div class="rbox"><h4>⭐ 最多加分</h4>${top(c.topGain, 'p')}<h4 style="margin-top:12px">❗ 需要留意</h4>${top(c.topLoss, 'n')}</div>${sibs}</div>`;
}
