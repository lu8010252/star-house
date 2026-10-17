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
    headers: { 'Content-Type': 'application/json', 'x-token': store.get('xt_token') || '' },
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
