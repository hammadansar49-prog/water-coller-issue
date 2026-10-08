import { firebaseConfig } from './firebase-config.js';

const GROUPS = [['Hammad', 'Arshad'], ['Sarib', 'Taha'], ['Ali Hussain', 'Ahtsham'], ['Abdullah', 'Ismail', 'Rohail']];
const LOCAL_KEY = 'cooler-duty-web-v1';
const fresh = () => ({ queue: [0, 1, 2, 3], counts: [0, 0, 0, 0], history: [], skips: [] });
const gname = (i) => GROUPS[i].join(' + ');
const $ = (id) => document.getElementById(id);

// Ek entry ke baad 24 ghante tak nayi entry nahi.
const LOCK_MS = 24 * 60 * 60 * 1000;
const unlockAt = (st) => ((st.history && st.history[0] && st.history[0].at) || 0) + LOCK_MS;
function lockMsg(st) {
  const left = unlockAt(st) - Date.now();
  const h = Math.floor(left / 3600000), m = Math.ceil((left % 3600000) / 60000);
  const at = new Date(unlockAt(st)).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  return `Abhi 24 ghante nahi hue. Agli entry ${at} ke baad ho sakegi (${h}h ${m}m baqi).`;
}

// Pure state change: jo group gaya woh line ke end mein, jiski bari thi woh aage hi rehta hai.
function applyFill(st, g) {
  if (Date.now() < unlockAt(st)) return { next: null, msg: lockMsg(st) };
  const d = new Date();
  const time = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const early = st.queue[0] !== g;
  const name = gname(g);
  const counts = st.counts.slice(); counts[g]++;
  const queue = st.queue.filter((x) => x !== g).concat([g]);
  const history = [{ name: name + (early ? ' (bari se pehle)' : ''), time, at: d.getTime() }].concat(st.history).slice(0, 50);
  const skips = early
    ? [{ name: gname(st.queue[0]), by: name, time, at: d.getTime() }].concat(st.skips || []).slice(0, 30)
    : (st.skips || []);
  const msg = early ? `${name} ne pehle bhar diya. Ab bari ${gname(queue[0])} ki.` : `Shabash! ${name} ne bhar diya · ${time}`;
  return { next: { queue, counts, history, skips }, msg };
}

/* ---------- storage: Firebase (shared) or local ---------- */
let store;
if (firebaseConfig.apiKey) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const db = fs.getFirestore(initializeApp(firebaseConfig));
  const ref = fs.doc(db, 'cooler', 'state');
  store = {
    mode: 'shared',
    subscribe(cb) {
      fs.onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : fresh()),
        (err) => { console.error('Firestore', err); $('syncNote').textContent = 'Database se connect nahi ho saka. Internet check karo.'; });
    },
    async fill(g) {
      let msg = '';
      await fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const r = applyFill(snap.exists() ? snap.data() : fresh(), g);
        msg = r.msg;
        if (r.next) tx.set(ref, r.next);
      });
      return msg;
    }
  };
} else {
  let cb = () => {};
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || fresh(); } catch { return fresh(); } };
  store = {
    mode: 'local',
    subscribe(f) { cb = f; f(read()); },
    async fill(g) {
      const r = applyFill(read(), g);
      if (!r.next) return r.msg;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(r.next)); } catch {}
      cb(r.next);
      return r.msg;
    }
  };
}

/* ---------- rendering ---------- */
let state = fresh();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WAVES = `<svg class="wave2" viewBox="0 0 1200 30" preserveAspectRatio="none"><path d="M0 15 Q75 0 150 15 T300 15 T450 15 T600 15 T750 15 T900 15 T1050 15 T1200 15 V30 H0Z" fill="rgba(239,68,68,.25)"/></svg><svg class="wave1" viewBox="0 0 1200 22" preserveAspectRatio="none"><path d="M0 11 Q50 0 100 11 T200 11 T300 11 T400 11 T500 11 T600 11 T700 11 T800 11 T900 11 T1000 11 T1100 11 T1200 11 V22 H0Z" fill="rgba(239,68,68,.35)"/></svg><span class="bub" style="left:70%;width:6px;height:6px"></span>`;

function render() {
  const cur = state.queue[0];
  $('curNo').textContent = cur + 1;
  $('curFirst').textContent = GROUPS[cur][0];
  $('curRest').textContent = '+ ' + GROUPS[cur].slice(1).join(' + ');
  $('nextName').textContent = gname(state.queue[1]);
  $('total').textContent = state.history.length;
  document.body.classList.toggle('locked', Date.now() < unlockAt(state));

  $('rows').innerHTML = state.queue.map((i, pos) => {
    const tag = pos === 0 ? 'Abhi' : pos === 1 ? 'Agla' : 'Wait';
    return `<tr class="${pos === 0 ? 'on' : ''}">
      <td><span class="badge">${i + 1}</span></td>
      <td><span class="gname">${esc(gname(i))}</span><div class="mtag"><b class="st ${tag.toLowerCase()}">${tag}</b> · ${state.counts[i]} baar</div></td>
      <td class="c-status"><span class="st ${tag.toLowerCase()}">${tag}</span></td>
      <td class="c-count">${state.counts[i]}</td>
      <td class="act"><button class="ghost" type="button" data-g="${i}">Hum ne bhara</button></td>
    </tr>`;
  }).join('');

  const skips = (state.skips || []).slice(0, 5);
  $('skipList').innerHTML = skips.length
    ? skips.map((k) => `<div class="skip"><div class="rliq">${WAVES}</div><span class="n">${esc(k.name)}</span><span class="b">Nahi gaye · ${esc(k.by)} ne bhara</span><span class="t">${esc(k.time)}</span></div>`).join('')
    : '<p class="empty">Abhi tak sab ne apni bari nibhayi.</p>';

  const hist = state.history.slice(0, 6);
  $('histList').innerHTML = hist.length
    ? hist.map((h) => `<div class="hitem"><span class="n">${esc(h.name)}</span><span class="t">${esc(h.time)}</span></div>`).join('')
    : '<p class="empty">Abhi tak koi entry nahi. Pehli bari mark karo.</p>';
}

/* ---------- water animation + actions ---------- */
let tDrain, tToast;
function splash(msg) {
  $('tankLevel').style.height = '95%'; $('tankPct').textContent = '95%';
  $('heroLiq').style.height = '55%';
  clearTimeout(tDrain);
  tDrain = setTimeout(() => {
    $('tankLevel').style.height = '20%'; $('tankPct').textContent = '20%';
    $('heroLiq').style.height = '18%';
  }, 700);
  $('toastMsg').textContent = msg; $('toast').hidden = false;
  clearTimeout(tToast);
  tToast = setTimeout(() => { $('toast').hidden = true; }, 3600);
}

function notify(msg) {
  $('toastMsg').textContent = msg; $('toast').hidden = false;
  clearTimeout(tToast);
  tToast = setTimeout(() => { $('toast').hidden = true; }, 5000);
  $('toast').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ask(g) {
  const d = $('ask');
  $('askName').textContent = gname(g);
  return new Promise((res) => {
    const done = (v) => { d.onclose = null; if (d.open) d.close(); res(v); };
    $('askYes').onclick = () => done(true);
    $('askNo').onclick = () => done(false);
    d.onclose = () => done(false);
    d.showModal();
    $('askNo').focus();
  });
}

let busy = false;
async function fill(g) {
  if (busy) return;
  if (Date.now() < unlockAt(state)) { notify(lockMsg(state)); return; }
  if (!(await ask(g))) return;
  busy = true; $('fillBtn').disabled = true;
  try { splash(await store.fill(g)); }
  catch (err) { console.error('Save failed', err); splash('Save nahi ho saka. Dobara try karo.'); }
  finally { busy = false; $('fillBtn').disabled = false; }
}

$('fillBtn').addEventListener('click', () => fill(state.queue[0]));
$('rows').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-g]');
  if (b) fill(Number(b.dataset.g));
});

$('syncNote').textContent = store.mode === 'shared' ? 'Live sync on · sab ko same data dikhta hai' : 'Local mode · data sirf is browser mein hai';
render();
setInterval(render, 60000);
store.subscribe((s) => { state = { ...fresh(), ...s }; render(); });
