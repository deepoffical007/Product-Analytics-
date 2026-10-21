/* GyaanSetu web client. Talks to the Java Servlet API with relative URLs ("api/..."),
   so it works at the server root or under a Tomcat context path such as /gyaansetu/. */
'use strict';
(() => {
  /* ---------------- Reference data (presentation only; data comes from the API) ---------------- */
  const SUBJ = {
    cs: { color: '#3456e0', icon: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
    math: { color: '#109a74', icon: '<path d="M5 7h6M8 4v6M14 7h5M5 14l5 5M10 14l-5 5M14 15h5M14 19h5"/>' },
    physics: { color: '#7552e0', icon: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>' },
    chemistry: { color: '#1490b0', icon: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>' },
    biology: { color: '#4b9a2a', icon: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19l8-8"/>' },
    language: { color: '#d17d0a', icon: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h5"/>' },
    economics: { color: '#c23f78', icon: '<path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/>' },
    history: { color: '#8a5a2b', icon: '<path d="M3 21h18M5 21V11M9.5 21V11M14.5 21V11M19 21V11M2 11l10-6 10 6z"/>' }
  };
  const TYPE = {
    video: { label: 'Video', icon: 'i-video', color: 'var(--t-video)', cta: 'Watch video' },
    pdf: { label: 'PDF', icon: 'i-pdf', color: 'var(--t-pdf)', cta: 'Open PDF' },
    article: { label: 'Article', icon: 'i-article', color: 'var(--t-article)', cta: 'Read article' },
    tutorial: { label: 'Tutorial', icon: 'i-tutorial', color: 'var(--t-tutorial)', cta: 'Start tutorial' },
    image: { label: 'Image', icon: 'i-image', color: 'var(--t-image)', cta: 'View image' }
  };
  const SIGNALS = [['rel', 'Relevance', '#3346e0'], ['rating', 'Rating', '#f2a01b'], ['feedback', 'Sentiment & feedback', '#12925f'],
    ['eng', 'Likes per view', '#c23f78'], ['pop', 'Views', '#8a93ad'], ['personal', 'For you', '#1490b0']];
  const DEFAULT_W = { rel: 40, rating: 20, feedback: 15, eng: 15, pop: 10, personal: 5 };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const AV_COLORS = ['#3456e0', '#109a74', '#d17d0a', '#c23f78', '#7552e0', '#1490b0', '#8a5a2b', '#4b9a2a'];
  const SAMPLE_NOTES = `Python Basics – Study Notes

Python is a high-level, interpreted programming language known for readable syntax. Code is organised with indentation instead of braces, so consistent spacing matters.

Variables are created by assignment and do not need a declared type. Common data types are int, float, str and bool. Collections include lists (ordered and mutable), tuples (ordered and immutable), sets (unordered with unique items) and dictionaries (key-value pairs).

Control flow uses if, elif and else for decisions. Loops include for loops, which iterate over a sequence such as a list or range, and while loops, which repeat while a condition is true. The break statement exits a loop early and continue skips to the next iteration.

Functions are defined with the def keyword. They can take parameters, return values with return, and have default arguments. Functions help you reuse code and keep programs organised.

Modules let you split code into files and reuse it with import. The standard library includes modules such as math, random, datetime and os.

Errors are handled with try and except blocks so that a program can recover from problems such as invalid input or missing files. Files are opened with the open function, ideally inside a with statement so they close automatically.`;

  /* ---------------- State ---------------- */
  const S = {
    me: null, meta: null, view: 'home', query: '', logNext: false, aiPath: null, authTab: 'login', returnTo: null,
    F: { types: new Set(), subject: '', level: '', minRating: 0, minViews: 0, sort: 'best' },
    W: { ...DEFAULT_W }, fromResults: false, filtersOpen: null
  };
  const ASSIST = { name: 'Python_Basics_Notes.txt', kind: 'TXT', text: SAMPLE_NOTES, size: SAMPLE_NOTES.length, resId: null, sample: true,
    tab: 'summary', out: {}, chat: [], busy: false, qaNote: '' };
  let renderSeq = 0;
  const store = {   // sessionStorage can throw in private windows; fall back to memory
    mem: {},
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { this.mem[k] = v; } },
    take(k) { let v = null; try { v = sessionStorage.getItem(k); sessionStorage.removeItem(k); } catch (e) { /* use memory */ } if (v == null) { v = this.mem[k] || null; delete this.mem[k]; } return v; }
  };

  /* ---------------- Helpers ---------------- */
  const $ = id => document.getElementById(id);
  const app = $('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  const ic = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
  const sic = (paths, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const starStr = v => { const f = Math.max(0, Math.min(5, Math.round(v))); return '★'.repeat(f) + '☆'.repeat(5 - f); };
  const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avColor = n => AV_COLORS[[...(n || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
  const subjName = k => (S.meta && S.meta.subjects.find(s => s.key === k) || { name: k }).name;
  const typeTag = t => `<span class="tag ${t}">${TYPE[t] ? TYPE[t].label : esc(t)}</span>`;
  const dots = '<span class="dots"><i></i><i></i><i></i></span>';
  const qualityColor = q => q === 'Excellent' || q === 'Very good' ? 'var(--good)' : q === 'Good' ? 'var(--warn)' : 'var(--bad)';
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const firstName = () => S.me ? S.me.name.split(' ')[0] : 'there';

  function highlighter(words) {
    if (!words || !words.length) return s => esc(s);
    const stem = w => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
    const terms = [...new Set(words.flatMap(w => [w, stem(w)]))].filter(t => /^[a-z0-9]{2,}$/.test(t)).sort((a, b) => b.length - a.length);
    if (!terms.length) return s => esc(s);
    const re = new RegExp('(?<![&#\\w])(' + terms.join('|') + ')[a-z]*', 'gi');
    return s => esc(s).replace(re, m => `<mark>${m}</mark>`);
  }
  function rng(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; }; }
  function thumb(it, wide) {
    const W0 = wide ? 320 : 160, H0 = wide ? 180 : 100, cx = W0 / 2, cy = H0 / 2 - 2, k = wide ? 1.7 : 1;
    const col = (SUBJ[it.subject] || SUBJ.cs).color, r = rng(it.id);
    let pat = '';
    for (let j = 0; j < 7; j++) pat += `<circle cx="${(r() * W0).toFixed(1)}" cy="${(r() * H0).toFixed(1)}" r="${(10 + r() * (wide ? 80 : 42)).toFixed(1)}" fill="#fff" fill-opacity="${(0.07 + r() * 0.1).toFixed(2)}"/>`;
    const g = {
      video: `<circle cx="${cx}" cy="${cy}" r="${17 * k}" fill="#fff"/><path d="M${cx - 5 * k} ${cy - 8 * k} L${cx + 9 * k} ${cy} L${cx - 5 * k} ${cy + 8 * k} Z" fill="${col}"/>`,
      pdf: `<g transform="translate(${cx} ${cy}) scale(${k})"><path d="M-14 -19 h20 l8 8 v30 h-28 Z" fill="#fff"/><path d="M6 -19 v8 h8" fill="none" stroke="${col}" stroke-width="1.5"/>${[0, 1, 2, 3].map(i => `<rect x="-9" y="${-6 + i * 6}" width="${i === 3 ? 10 : 18}" height="2.2" rx="1" fill="${col}" fill-opacity=".7"/>`).join('')}</g>`,
      article: `<g transform="translate(${cx} ${cy}) scale(${k})">${[0, 1, 2, 3].map(i => `<rect x="-22" y="${-14 + i * 9}" width="${i === 0 ? 44 : i === 3 ? 26 : 40}" height="${i === 0 ? 5 : 3.5}" rx="1.8" fill="#fff" fill-opacity="${i === 0 ? 1 : .85}"/>`).join('')}</g>`,
      image: `<g transform="translate(${cx} ${cy}) scale(${k})"><rect x="-22" y="-16" width="44" height="32" rx="3" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="10" cy="-7" r="4" fill="#fff"/><path d="M-19 13 L-6 -2 L3 7 L9 2 L19 13 Z" fill="#fff" fill-opacity=".92"/></g>`,
      tutorial: `<g transform="translate(${cx} ${cy}) scale(${k})">${[0, 1, 2].map(i => `<rect x="-20" y="${-13 + i * 10}" width="7" height="7" rx="1.5" fill="${i < 2 ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.6"/><rect x="-9" y="${-11 + i * 10}" width="${28 - i * 5}" height="3.4" rx="1.7" fill="#fff" fill-opacity=".9"/>`).join('')}</g>`
    }[it.type] || '';
    return `<svg viewBox="0 0 ${W0} ${H0}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(it.typeLabel || it.type)} thumbnail for ${esc(it.title)}"><defs><linearGradient id="g-${esc(it.id)}${wide ? 'w' : ''}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".78"/></linearGradient></defs><rect width="${W0}" height="${H0}" fill="url(#g-${esc(it.id)}${wide ? 'w' : ''})"/>${pat}${g}<text x="${8 * k}" y="${H0 - 8 * k}" font-family="JetBrains Mono, monospace" font-size="${wide ? 12 : 8.5}" fill="#fff" fill-opacity=".92">${esc((it.call || '') + ' · ' + (it.typeCode || ''))}</text></svg>`;
  }
  const sbar = parts => `<div class="sbar" aria-hidden="true">${SIGNALS.filter(([k]) => parts[k] != null).map(([k, , c]) => `<i style="width:${parts[k].toFixed(1)}%;background:${c}"></i>`).join('')}</div>`;
  function md(text) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trimEnd(); let m;
      if (!line.trim()) { close(); continue; }
      if ((m = line.match(/^#{1,4}\s+(.*)/))) { close(); out.push(`<h4>${inline(m[1])}</h4>`); }
      else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
      else { close(); out.push(`<p>${inline(line)}</p>`); }
    }
    close();
    return `<div class="md">${out.join('')}</div>`;
  }
  let toastTimer;
  function toast(msg, err) { if (!msg) return; const t = $('toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2800); }

  /* ---------------- API ---------------- */
  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (init.method !== 'GET') init.headers['X-Requested-With'] = 'GyaanSetu';
    if (opts.form) init.body = opts.form;
    else if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    let res;
    try { res = await fetch(path, init); } catch (e) { throw { status: 0, message: 'Cannot reach the GyaanSetu server. Check that it is running.' }; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON body */ }
    if (!res.ok) throw { status: res.status, message: (data && data.error) || `Request failed (${res.status}).` };
    return data;
  }
  function fail(e) {
    if (e && e.status === 401) {
      S.me = null; renderUser();
      toast(e.message || 'Please sign in to continue.', true);
      S.returnTo = location.hash || '#home';
      location.hash = '#login';
      return;
    }
    toast((e && e.message) || 'Something went wrong.', true);
  }
  const requireLogin = () => { if (S.me) return true; S.returnTo = location.hash || '#home'; toast('Sign in to do that. Try the demo account.', true); location.hash = '#login'; return false; };

  /* ---------------- Router ---------------- */
  function parseHash() {
    const h = location.hash.slice(1);
    const [path, qs] = h.split('?');
    return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(qs || '') };
  }
  async function route() {
    const { parts, params } = parseHash();
    const v = parts[0] || 'home';
    const seq = ++renderSeq;
    try {
      switch (v) {
        case 'search': S.query = params.get('q') || ''; setView('results'); await renderResults(seq); break;
        case 'resource': setView('detail'); await renderDetail(parts[1], seq); break;
        case 'assistant': setView('assistant'); renderAssistant(); break;
        case 'dashboard': setView('dashboard'); await renderDashboard(seq); break;
        case 'community': setView('community'); await renderCommunity(parts[1], seq); break;
        case 'login': setView('login'); renderLogin(); break;
        default: setView('home'); await renderHome(seq);
      }
    } catch (e) {
      if (seq !== renderSeq) return;
      if (e && e.status === 401) { fail(e); return; }
      app.innerHTML = `<div class="wrap"><div class="card empty" style="margin-top:32px"><h3>${esc(e && e.message || 'Could not load this page.')}</h3><p class="muted">Check that the server is running, then try again.</p><a class="btn primary" href="#home">Go home</a></div></div>`;
    }
  }
  function setView(view) {
    const changed = S.view !== view;
    S.view = view;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === view || (view === 'detail' && a.dataset.nav === 'results')));
    $('nav').classList.toggle('onhome', view === 'home');
    $('nav').classList.toggle('onsearch', view === 'results' || view === 'detail');
    if (view !== 'results' && view !== 'detail') $('hq').value = '';
    if (changed) window.scrollTo({ top: 0 });
  }
  function search(q, opts = {}) {
    S.query = (q || '').trim(); S.aiPath = null; S.logNext = true;
    if (opts.types) { S.F.types = new Set(opts.types); S.F.subject = ''; }
    const target = '#search' + (S.query ? '?q=' + encodeURIComponent(S.query) : '');
    if (location.hash === target) route(); else location.hash = target;
  }
  function renderUser() {
    $('userSlot').innerHTML = S.me
      ? `<a class="userchip" href="#dashboard" title="${esc(S.me.name)}"><span class="avatar">${esc(initials(S.me.name))}</span><span class="nm">Hi, ${esc(firstName())}</span></a><button class="iconbtn" id="logoutBtn" aria-label="Sign out" title="Sign out">${ic('i-logout')}</button>`
      : `<a class="btn primary sm signin" href="#login">${ic('i-user')}<span>Login / Sign up</span></a>`;
    const lo = $('logoutBtn');
    if (lo) lo.onclick = async () => { try { await api('api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ } S.me = null; renderUser(); toast('Signed out.'); location.hash = '#home'; };
  }

  /* ---------------- Shared fragments ---------------- */
  function tileHTML(it) {
    return `<a class="tile" href="#resource/${encodeURIComponent(it.id)}"><div class="th">${thumb(it)}</div><div class="tb">
      <div class="tt">${esc(it.title)}</div>
      <div class="meta">${typeTag(it.type)}<span>${esc(it.source)}</span></div>
      <div class="meta"><span class="stars">★</span><span class="mono">${it.rating.toFixed(1)}</span><span>(${fmt(it.ratingCount)})</span><span>·</span><span>${fmt(it.views)} views</span></div>
    </div></a>`;
  }
  function sideNav(on) {
    return `<nav class="card sidenav" aria-label="Workspace">${[['#home', 'i-home', 'Home', ''], ['#search', 'i-search', 'Search', ''], ['#dashboard', 'i-library', 'My Library', 'library'],
      ['#assistant', 'i-ai', 'AI Assistant', 'assistant'], ['#dashboard', 'i-dash', 'Dashboard', 'dashboard'], ['#community', 'i-community', 'Community', 'community']]
      .map(([h, i, l, key]) => `<a href="${h}" ${key === 'library' ? 'data-anchor="library"' : ''} class="${key && key === on ? 'on' : ''}">${ic(i)}${l}</a>`).join('')}</nav>`;
  }
  const loadingHTML = label => `<div class="wrap loading"><span class="thinking">${dots}${esc(label || 'Loading…')}</span></div>`;

  /* ---------------- Home ---------------- */
  async function renderHome(seq) {
    const m = S.meta;
    app.innerHTML = `
    <section class="hero"><div class="wrap heroin">
      <div>
        <span class="kicker">${ic('i-spark')}One place for the best open learning resources</span>
        <h1>Discover the <em>Best</em> Educational Content with AI</h1>
        <p class="tagline">Search • Explore • Learn • Grow</p>
        <form class="bigsearch" id="bigSearch" role="search">
          <input id="bq" type="search" list="suggest" autocomplete="off" placeholder="Search for any topic… (e.g. Python, Calculus, Photosynthesis)" aria-label="Search for any topic">
          <button type="submit">${ic('i-search')}<span>Search</span></button>
        </form>
        <div class="quicktypes">
          ${[['video', 'Videos'], ['pdf', 'Notes & PDFs'], ['article', 'Articles'], ['tutorial', 'Tutorials'], ['image', 'Images']].map(([t, l]) => `<button type="button" data-qtype="${t}" style="--c:${TYPE[t].color}">${ic(TYPE[t].icon)}${l}</button>`).join('')}
        </div>
        <div class="herostats"><span><b>${m.totals.resources}</b>curated resources</span><span><b>${m.totals.reviews}</b>learner reviews</span><span><b>${m.totals.learners}</b>learners</span><span><b>${m.ai.mode === 'claude' ? 'Claude' : 'Offline'}</b>AI mode</span></div>
      </div>
      <div class="heroart" aria-hidden="true">${heroArt()}</div>
    </div></section>
    <div class="wrap">
      <div class="homegrid">
        <div class="card pad">
          <div class="sectionhead"><h2>Popular Subjects</h2><a class="btn ghost sm" href="#search">Explore all</a></div>
          <div class="subjects">${m.subjects.map(s => `<button type="button" class="subj" data-subject="${s.key}" style="--c:${(SUBJ[s.key] || SUBJ.cs).color}"><span class="ic">${sic((SUBJ[s.key] || SUBJ.cs).icon)}</span>${esc(s.name)}<small>${s.count} ${s.count === 1 ? 'resource' : 'resources'}</small></button>`).join('')}</div>
        </div>
        <div class="card pad">
          <div class="sectionhead"><h2>Trending Searches</h2></div>
          <ol class="trend">${m.trending.slice(0, 6).map((t, i) => `<li><a href="#search?q=${encodeURIComponent(t.q)}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(t.q)}<span class="ct">${t.count} results</span></a></li>`).join('')}</ol>
        </div>
      </div>
      <div id="recBox"></div>
      <div class="sectionhead"><h2>Top-ranked resources</h2><span class="small muted">Ranked by ratings, sentiment, likes and views</span></div>
      <div class="tiles" id="topTiles">${loadingHTML()}</div>
      <div class="sectionhead" style="margin-top:28px"><h2>More ways to learn</h2></div>
      <div class="features">
        <a class="feature" href="#assistant" style="--c:#3346e0"><span class="ic">${ic('i-ai')}</span><span><b>AI Study Assistant</b><span>Upload notes or a PDF and get summaries, key points, quizzes and answers.</span></span></a>
        <a class="feature" href="#dashboard" style="--c:#109a74"><span class="ic">${ic('i-calendar')}</span><span><b>Study Planner</b><span>Plan weekly goals and let AI suggest a plan from your interests.</span></span></a>
        <a class="feature" href="#community" style="--c:#d17d0a"><span class="ic">${ic('i-community')}</span><span><b>Community Forum</b><span>Ask questions, answer others, and get AI-drafted answers.</span></span></a>
        <a class="feature" href="#dashboard" data-anchor="leaderboard" style="--c:#c23f78"><span class="ic">${ic('i-trophy')}</span><span><b>Leaderboard</b><span>Earn points for reviews, answers and finished resources.</span></span></a>
      </div>
      <footer class="foot"><span><b>GyaanSetu</b> · Bridging the gap between students and knowledge.</span><span>Java Servlets + JDBC · Resources link to real open sources; engagement figures are sample data.</span></footer>
    </div>`;
    $('bigSearch').onsubmit = e => { e.preventDefault(); search($('bq').value); };
    const [top, rec] = await Promise.all([api('api/resources?limit=4&sort=best'), S.me ? api('api/resources/recommended?limit=4') : Promise.resolve(null)]);
    if (seq !== renderSeq) return;
    $('topTiles').innerHTML = top.items.map(tileHTML).join('');
    if (rec && rec.personalised && rec.items.length) {
      $('recBox').innerHTML = `<div class="sectionhead"><h2>Recommended for you</h2><span class="small muted">Based on what you liked, saved, rated and completed</span></div><div class="tiles" style="margin-bottom:28px">${rec.items.map(tileHTML).join('')}</div>`;
    }
  }
  function heroArt() {
    return `<svg viewBox="0 0 340 260"><defs><radialGradient id="glow"><stop offset="0" stop-color="#ffd76a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs>
    <circle cx="268" cy="62" r="62" fill="url(#glow)"/>
    <ellipse cx="165" cy="238" rx="140" ry="12" fill="#3346e0" opacity=".08"/>
    <rect x="40" y="186" width="240" height="46" rx="8" fill="#3346e0"/><rect x="48" y="194" width="224" height="10" rx="3" fill="#fff"/><rect x="48" y="210" width="224" height="3" rx="1.5" fill="#9fadff"/>
    <rect x="62" y="142" width="210" height="44" rx="8" fill="#fff" stroke="#dfe4ff" stroke-width="2"/><rect x="62" y="142" width="22" height="44" rx="6" fill="#6f80ff"/><rect x="92" y="152" width="170" height="6" rx="3" fill="#dfe4ff"/><rect x="92" y="166" width="120" height="6" rx="3" fill="#dfe4ff"/>
    <rect x="50" y="104" width="220" height="38" rx="8" fill="#1d2b8a"/><rect x="58" y="112" width="204" height="8" rx="3" fill="#fff" opacity=".92"/><rect x="230" y="104" width="12" height="38" fill="#ffc847"/>
    <path d="M160 34 L262 70 L160 106 L58 70 Z" fill="#0f1733"/>
    <path d="M100 86 V112 C100 124 128 132 160 132 C192 132 220 124 220 112 V86 L160 106 Z" fill="#26325f"/>
    <path d="M160 70 L236 80 V120" stroke="#ffc847" stroke-width="3" fill="none"/><circle cx="236" cy="124" r="6" fill="#ffc847"/>
    <circle cx="268" cy="58" r="20" fill="#ffd76a"/><path d="M262 76 h12 v9 h-12z" fill="#c9d0ea"/><path d="M268 50 v10 M263 60 h10" stroke="#e0a400" stroke-width="2"/>
    ${[[268, 24, 268, 14], [296, 36, 304, 30], [240, 36, 232, 30], [302, 60, 312, 60], [234, 60, 224, 60]].map(([a, b, c, d]) => `<path d="M${a} ${b} L${c} ${d}" stroke="#f2b632" stroke-width="3" stroke-linecap="round"/>`).join('')}
    </svg>`;
  }

  /* ---------------- Search results ---------------- */
  function resultsQuery() {
    const p = new URLSearchParams();
    if (S.query) p.set('q', S.query);
    if (S.F.types.size) p.set('types', [...S.F.types].join(','));
    if (S.F.subject) p.set('subject', S.F.subject);
    if (S.F.level) p.set('level', S.F.level);
    if (S.F.minRating) p.set('minRating', S.F.minRating);
    if (S.F.minViews) p.set('minViews', S.F.minViews);
    if (S.F.sort !== 'best') p.set('sort', S.F.sort);
    const w = Object.entries(S.W).filter(([k, v]) => DEFAULT_W[k] !== v);
    if (w.length) p.set('w', w.map(([k, v]) => k + ':' + v).join(','));
    if (S.logNext) { p.set('log', '1'); S.logNext = false; }
    return p.toString();
  }
  async function renderResults(seq, keepAdvanced) {
    $('hq').value = S.query;
    if (!$('resList')) app.innerHTML = loadingHTML('Ranking resources…');
    const res = await api('api/resources?' + resultsQuery());
    if (seq !== renderSeq) return;
    const hl = highlighter(res.words);
    if (S.filtersOpen == null) S.filtersOpen = matchMedia('(min-width: 901px)').matches;
    const advOpen = keepAdvanced || (document.querySelector('.adv') && document.querySelector('.adv').open);
    const ratingOpt = (v, l) => `<label class="opt"><input type="radio" name="fr" value="${v}" ${S.F.minRating === v ? 'checked' : ''}><span class="stars">${'★'.repeat(Math.floor(v || 0))}</span>${l}</label>`;
    const sortOpt = (v, l) => `<label class="opt"><input type="radio" name="fs" value="${v}" ${S.F.sort === v ? 'checked' : ''}>${l}</label>`;
    app.innerHTML = `<div class="wrap resgrid">
      <details class="card filters" id="filtersBox" ${S.filtersOpen ? 'open' : ''}>
        <summary>Filters</summary>
        <div class="fbody">
          <div class="rowbetween"><span class="small muted">${activeFilters()} active ${activeFilters() === 1 ? 'filter' : 'filters'}</span><button class="btn sm" id="resetF" type="button" ${activeFilters() ? '' : 'disabled'}>Reset filters</button></div>
          <div class="fgroup"><span class="lbl">Content Type</span>
            <label class="opt"><input type="checkbox" data-ftype="all" ${S.F.types.size ? '' : 'checked'}>All<span class="ct">${res.matched}</span></label>
            ${Object.entries(TYPE).map(([k, t]) => `<label class="opt"><input type="checkbox" data-ftype="${k}" ${S.F.types.has(k) ? 'checked' : ''}>${t.label}<span class="ct">${res.typeCounts[k] || 0}</span></label>`).join('')}
          </div>
          <div class="fgroup"><label class="lbl" for="fSubject">Subject</label>
            <select class="field" id="fSubject"><option value="">All Subjects</option>${S.meta.subjects.map(s => `<option value="${s.key}" ${S.F.subject === s.key ? 'selected' : ''}>${esc(s.name)} (${res.subjectCounts[s.key] || 0})</option>`).join('')}</select>
          </div>
          <div class="fgroup"><span class="lbl">Rating</span>${ratingOpt(0, 'Any rating')}${ratingOpt(4.5, '4.5 & above')}${ratingOpt(4, '4 & above')}${ratingOpt(3, '3 & above')}</div>
          <div class="fgroup"><span class="lbl">Sort By</span>${sortOpt('best', 'Relevance (best match)')}${sortOpt('views', 'Most viewed')}${sortOpt('rating', 'Highest rated')}${sortOpt('likes', 'Most liked')}${sortOpt('newest', 'Newest')}</div>
          <details class="adv" ${advOpen ? 'open' : ''}>
            <summary>Advanced filters & ranking weights</summary>
            <div class="fbody" style="padding:12px 0 0">
              <div class="fgroup"><label class="lbl" for="fLevel">Level</label><select class="field" id="fLevel"><option value="">Any level</option>${['Beginner', 'Intermediate', 'Advanced'].map(l => `<option ${S.F.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="fgroup"><label class="lbl" for="fPop">Popularity</label><select class="field" id="fPop">${[[0, 'Any number of views'], [100000, '100k+ views'], [1000000, '1M+ views'], [5000000, '5M+ views']].map(([v, l]) => `<option value="${v}" ${S.F.minViews === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="fgroup"><span class="lbl">Ranking weights (sent to the server)</span><div class="weights">${SIGNALS.map(([k, l, c]) => `<div class="weight"><span class="sw" style="background:${c}"></span><label for="w-${k}">${l}</label><output id="o-${k}">${S.W[k]}</output><input type="range" id="w-${k}" min="0" max="50" value="${S.W[k]}" data-w="${k}"></div>`).join('')}</div></div>
              <div class="formula">score = Σ wᵢ·sᵢ / Σ wᵢ<br>BM25 relevance · Bayesian rating · comment sentiment + helpful votes · likes per view · log views · your interests</div>
              <button class="btn ghost sm" id="resetW" type="button" style="justify-self:start">Restore default weights</button>
            </div>
          </details>
        </div>
      </details>
      <div id="resList">
        <div class="reshead">
          <div><h1>${S.query ? `Search Results for “${esc(S.query)}”` : 'Explore all resources'}</h1><div class="small muted" aria-live="polite">Found ${res.total} ${res.total === 1 ? 'result' : 'results'}${res.personalised ? ' · personalised for you' : ''}</div></div>
          ${S.query && res.total > 1 ? `<button class="btn primary sm" id="aiPathBtn" type="button">${ic('i-ai')}Build AI learning path</button>` : ''}
        </div>
        ${res.expanded.length ? `<p class="expandnote">Also searching related concepts: ${res.expanded.map(e => `<b>${esc(e)}</b>`).join(', ')}</p>` : ''}
        <div id="aiPathBox">${S.aiPath ? aiPathHTML() : ''}</div>
        ${res.items.length ? `<ol class="results">${res.items.map((it, i) => resultHTML(it, i, hl)).join('')}</ol>` :
          `<div class="card empty"><h3>No resources match ${S.query ? '“' + esc(S.query) + '”' : 'these filters'}.</h3><p class="muted">Try a broader topic or reset the filters.</p><div class="suggests">${S.meta.trending.slice(0, 4).map(t => `<button type="button" data-q="${esc(t.q)}">${esc(t.q)}</button>`).join('')}</div><button class="btn" type="button" data-action="resetF">Reset filters</button></div>`}
        <p class="note">Views, likes, ratings and seed reviews are sample data stored in the database. Every like, rating, review and view you add is saved by the server and changes the ranking for everyone.</p>
      </div>
    </div>`;
    bindResults();
  }
  function resultHTML(it, i, hl) {
    return `<li class="result">
      <a class="th" href="#resource/${encodeURIComponent(it.id)}" aria-label="Open ${esc(it.title)}" data-from="results">${thumb(it)}</a>
      <div class="rb">
        <span class="rank">#${i + 1}</span>
        <div class="rt"><a href="#resource/${encodeURIComponent(it.id)}" data-from="results">${hl(it.title)}</a></div>
        <div class="src">${ic(TYPE[it.type].icon)}${esc(it.source)} · ${esc(it.subjectName)} · ${esc(it.level)}</div>
        <p class="desc">${hl(it.desc)}</p>
        <div class="st"><span><span class="stars">★</span> <span class="mono">${it.rating.toFixed(1)}</span> (${fmt(it.ratingCount)})</span><span><span class="mono">${fmt(it.views)}</span> views</span><span><span class="mono">${fmt(it.likes)}</span> likes</span><span class="pill ${it.sentiment > 0.15 ? 'pos' : it.sentiment < -0.15 ? 'neg' : 'neu'}">${it.positivePct}% positive</span></div>
      </div>
      <div class="side">
        ${typeTag(it.type)}
        <div class="qchip" title="Quality score"><b>${Math.round(it.score)}<small>/100</small></b><span style="color:${qualityColor(it.quality)}">${esc(it.quality)}</span></div>
        ${sbar(it.parts)}
        <button class="iconbtn" type="button" data-save="${esc(it.id)}" aria-pressed="${it.user.saved}" aria-label="${it.user.saved ? 'Remove from library' : 'Save to library'}">${ic('i-bookmark')}</button>
      </div>
    </li>`;
  }
  function rerunResults(keepAdvanced) { const seq = ++renderSeq; renderResults(seq, keepAdvanced).catch(fail); }
  function bindResults() {
    $('filtersBox').addEventListener('toggle', e => { S.filtersOpen = e.target.open; });
    app.querySelectorAll('[data-ftype]').forEach(c => c.onchange = () => {
      const t = c.dataset.ftype;
      if (t === 'all') S.F.types.clear(); else if (c.checked) S.F.types.add(t); else S.F.types.delete(t);
      rerunResults();
    });
    $('fSubject').onchange = e => { S.F.subject = e.target.value; rerunResults(); };
    $('fLevel').onchange = e => { S.F.level = e.target.value; rerunResults(true); };
    $('fPop').onchange = e => { S.F.minViews = +e.target.value; rerunResults(true); };
    app.querySelectorAll('[name=fr]').forEach(c => c.onchange = () => { S.F.minRating = +c.value; rerunResults(); });
    app.querySelectorAll('[name=fs]').forEach(c => c.onchange = () => { S.F.sort = c.value; rerunResults(); });
    let wt;
    app.querySelectorAll('[data-w]').forEach(s => s.oninput = () => { S.W[s.dataset.w] = +s.value; $('o-' + s.dataset.w).textContent = s.value; clearTimeout(wt); wt = setTimeout(() => rerunResults(true), 200); });
    $('resetW').onclick = () => { S.W = { ...DEFAULT_W }; rerunResults(true); };
    $('resetF').onclick = resetFilters;
    const ap = $('aiPathBtn'); if (ap) ap.onclick = buildPath;
  }
  const activeFilters = () => S.F.types.size + (S.F.subject ? 1 : 0) + (S.F.level ? 1 : 0) + (S.F.minRating ? 1 : 0) + (S.F.minViews ? 1 : 0) + (S.F.sort !== 'best' ? 1 : 0);
  function resetFilters() { S.F = { types: new Set(), subject: '', level: '', minRating: 0, minViews: 0, sort: 'best' }; rerunResults(); }
  function aiPathHTML() {
    const p = S.aiPath;
    if (p.loading) return `<div class="aipath"><h3>${ic('i-ai')}AI learning path</h3><span class="thinking">${dots}Reading the top results and ordering them for you…</span></div>`;
    return `<div class="aipath"><h3>${ic('i-ai')}AI learning path for “${esc(p.q)}” <span class="small muted" style="font-weight:600">${p.mode === 'claude' ? '· written by Claude' : '· offline ordering'}</span></h3>
      ${p.intro ? `<p class="small">${esc(p.intro)}</p>` : ''}
      <ol>${p.steps.map(s => `<li><a href="#resource/${encodeURIComponent(s.item.id)}" data-from="results">${esc(s.item.title)}</a> ${typeTag(s.item.type)}<p>${esc(s.why)}</p></li>`).join('')}</ol>
      ${p.message ? `<p class="notice">${esc(p.message)}</p>` : ''}
    </div>`;
  }
  async function buildPath() {
    S.aiPath = { loading: true, q: S.query }; $('aiPathBox').innerHTML = aiPathHTML();
    try {
      const r = await api('api/ai/path', { method: 'POST', body: { q: S.query } });
      S.aiPath = { q: S.query, ...r };
    } catch (e) { S.aiPath = null; fail(e); }
    if ($('aiPathBox')) $('aiPathBox').innerHTML = S.aiPath ? aiPathHTML() : '';
  }

  /* ---------------- Detail ---------------- */
  async function renderDetail(id, seq, opts = {}) {
    if (!opts.keep) app.innerHTML = loadingHTML();
    const q = S.fromResults ? S.query : '';
    const d = await api('api/resources/' + encodeURIComponent(id) + '?' + new URLSearchParams({ q, view: opts.keep ? '0' : '1' }));
    if (seq !== renderSeq) return;
    const it = d.item, mine = it.user.rating || 0, qc = qualityColor(it.quality), C = 2 * Math.PI * 52;
    const raw = { rel: q ? `matches “${esc(q)}”` : '', rating: `${it.rating.toFixed(2)} ★ · ${it.ratingCount.toLocaleString()} ratings`, feedback: `${it.positivePct}% positive · ${Math.round(it.signals.helpful * 100)}% helpful`,
      eng: `${(it.likes / Math.max(1, it.views) * 100).toFixed(2)}% liked`, pop: `${fmt(it.views)} views`, personal: 'matches your interests' };
    const y = window.scrollY;
    app.innerHTML = `<div class="wrap" style="padding-bottom:48px">
      <a class="btn ghost back" href="${S.fromResults ? '#search' + (S.query ? '?q=' + encodeURIComponent(S.query) : '') : '#home'}">${ic('i-back')}Back to ${S.fromResults ? 'results' : 'home'}</a>
      <div class="card dtop">
        <div class="dmedia">${thumb(it, true)}</div>
        <div class="dinfo">
          <div class="small muted" style="display:flex;gap:8px;align-items:center">${typeTag(it.type)}<span class="mono">${esc(it.call)}</span></div>
          <h1>${esc(it.title)}</h1>
          <div class="meta"><span>${ic(TYPE[it.type].icon)} ${esc(it.source)}</span><span>·</span><span>${esc(it.subjectName)}</span><span>·</span><span>${esc(it.level)}</span></div>
          <div class="meta"><span class="stars">${starStr(it.rating)}</span><b class="mono" style="color:var(--ink)">${it.rating.toFixed(1)}</b><span>(${fmt(it.ratingCount)} ratings)</span><span>·</span><span>${fmt(it.views)} views</span><span>·</span><span>${fmt(it.likes)} likes</span></div>
          <div class="dacts">
            ${it.url ? `<a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${ic(TYPE[it.type].icon)}${TYPE[it.type].cta}</a>` : `<span class="btn" aria-disabled="true">Sample item · no link</span>`}
            <button class="btn" type="button" data-act="save" aria-pressed="${it.user.saved}">${ic('i-bookmark')}${it.user.saved ? 'Saved' : 'Save'}</button>
            <button class="btn like" type="button" data-act="like" aria-pressed="${it.user.liked}">${ic('i-heart')}${it.user.liked ? 'Liked' : 'Like'}</button>
            <button class="btn" type="button" data-act="complete" aria-pressed="${it.user.completed}">${ic('i-done')}${it.user.completed ? 'Completed' : 'Mark complete'}</button>
            <button class="btn" type="button" id="askAiBtn">${ic('i-ai')}Ask AI about this</button>
          </div>
        </div>
      </div>
      <div class="dgrid">
        <div class="card pad">
          <h2>Content Details</h2>
          <dl class="kv">
            <dt>Type</dt><dd>${esc(it.typeLabel)}</dd><dt>Subject</dt><dd>${esc(it.subjectName)}</dd>
            <dt>Source</dt><dd>${esc(it.source)}${it.verified ? ' <span class="pill pos" style="margin-left:6px">verified</span>' : ''}</dd>
            <dt>Duration / size</dt><dd>${esc(it.len)}</dd><dt>Level</dt><dd>${esc(it.level)}</dd>
            <dt>Updated</dt><dd>${it.date ? new Date(it.date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '—'}</dd>
            <dt>Topics</dt><dd>${it.tags.map(t => `<a class="btn ghost sm" style="padding:0 6px 0 0" href="#search?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join(' ')}</dd>
          </dl>
          <h2 style="margin-top:18px">Description</h2>
          <p>${esc(it.desc)}</p>
        </div>
        <div class="card pad">
          <h2>Quality Score</h2>
          <div class="gaugewrap">
            <svg class="gauge" viewBox="0 0 120 120" role="img" aria-label="Quality score ${Math.round(it.score)} out of 100">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#eef1f7" stroke-width="10"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="${qc}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * it.score / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
              <text x="60" y="62" text-anchor="middle" font-size="30" font-weight="800" fill="#0f1733">${Math.round(it.score)}</text>
              <text x="60" y="80" text-anchor="middle" font-size="11" fill="#5b6584">/100</text>
            </svg>
            <b style="color:${qc}">${esc(it.quality)}</b>
          </div>
          <ul class="checks">${d.checks.map(c => `<li class="${c.ok ? 'ok' : 'no'}">${ic(c.ok ? 'i-check' : 'i-x')}${esc(c.label)}</li>`).join('')}</ul>
          <details style="margin-top:12px"><summary class="small" style="cursor:pointer;font-weight:800;color:var(--accent)">How the server calculated this score</summary>
            <div class="tablewrap"><table class="breakdown"><thead><tr><th>Signal</th><th class="num">sᵢ</th><th class="num">wᵢ</th><th class="num">Points</th></tr></thead>
            <tbody>${SIGNALS.filter(([k]) => it.parts[k] != null).map(([k, l, c]) => `<tr><td><span style="color:${c}">●</span> ${l}<br><span class="small muted">${raw[k]}</span></td><td class="num">${it.signals[k].toFixed(2)}</td><td class="num">${d.weights[k]}</td><td class="num">${it.parts[k].toFixed(1)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="3"><b>Total</b></td><td class="num"><b>${it.score.toFixed(1)}</b></td></tr></tfoot></table></div>
          </details>
        </div>
        <div class="card pad" style="grid-column:1/-1">
          <h2>User Ratings & Feedback</h2>
          <div class="reviewtop">
            <div class="bigrate"><b>${it.rating.toFixed(1)}</b><div class="stars">${starStr(it.rating)}</div><div class="small muted">${it.ratingCount.toLocaleString()} ratings · ${it.positivePct}% positive reviews</div></div>
            <div class="dist">${[5, 4, 3, 2, 1].map((k, i) => `<div><span>${k} ★</span><span class="bar"><i style="width:${d.distribution[i]}%"></i></span><span class="mono muted">${d.distribution[i]}%</span></div>`).join('')}</div>
          </div>
          <form id="reviewForm" style="display:grid;gap:10px;margin-top:18px">
            <div class="rowbetween"><b>Write a review</b><div class="rateinput" role="group" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= mine ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}" aria-pressed="${n === mine}">★</button>`).join('')}<span class="small muted" style="margin-left:6px">${mine ? 'Your rating: ' + mine : 'Tap to rate'}</span></div></div>
            <label for="rtext" class="small muted">Tell other learners what worked and what didn't. The server scores the sentiment of your review and it feeds into the ranking.</label>
            <textarea class="field" id="rtext" maxlength="1500" placeholder="e.g. Clear explanations, but the exercises need answers."></textarea>
            <div class="rowbetween"><span id="rsent" class="small muted">Sentiment is scored when you post.</span>
              <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="small muted">Helpful?</span><button type="button" class="btn sm" data-fb="yes" aria-pressed="${it.user.feedback === 'yes'}">Yes</button><button type="button" class="btn sm" data-fb="no" aria-pressed="${it.user.feedback === 'no'}">No</button><button class="btn primary sm" type="submit">Post review</button></span></div>
          </form>
          <ul class="reviews" id="reviewList" style="margin-top:16px">${d.reviews.map((r, i) => `<li class="review" ${i >= 6 ? 'hidden' : ''}><span class="avatar" style="--c:${avColor(r.author)}">${esc(initials(r.author))}</span><div>
            <div class="rh"><b>${esc(r.author)}</b>${r.stars ? `<span class="stars small">${starStr(r.stars)}</span>` : ''}<span class="pill ${r.label === 'Positive' ? 'pos' : r.label === 'Negative' ? 'neg' : 'neu'}">${r.label}</span>${r.mine ? '<span class="small muted">your review</span>' : ''}</div>
            <p>${esc(r.body)}</p>
            <div class="rf"><span>${ago(r.createdAt)}</span><button type="button" data-rvote="${r.id}" aria-pressed="${r.voted}" aria-label="Mark helpful">${ic('i-thumb')} ${r.upvotes}</button></div>
          </div></li>`).join('')}</ul>
          ${d.reviews.length > 6 ? `<button class="btn sm" type="button" id="moreReviews" style="margin-top:12px">Show all ${d.reviews.length} reviews</button>` : ''}
        </div>
      </div>
      ${d.related.length ? `<div class="sectionhead" style="margin-top:24px"><h2>Related resources</h2></div><div class="tiles">${d.related.map(tileHTML).join('')}</div>` : ''}
    </div>`;
    if (opts.keep) window.scrollTo({ top: y });
    bindDetail(it);
  }
  function bindDetail(it) {
    const act = async (path, body, msgFallback) => {
      if (!requireLogin()) return;
      try {
        const r = await api('api/resources/' + encodeURIComponent(it.id) + '/' + path, { method: 'POST', body: body || {} });
        toast(r.message || msgFallback);
        await refreshMe();
        await renderDetail(it.id, renderSeq, { keep: true });
      } catch (e) { fail(e); }
    };
    app.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
    app.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { const n = +b.dataset.star; act('rate', { stars: it.user.rating === n ? 0 : n }); });
    app.querySelectorAll('[data-fb]').forEach(b => b.onclick = () => act('feedback', { value: it.user.feedback === b.dataset.fb ? '' : b.dataset.fb }));
    app.querySelectorAll('[data-rvote]').forEach(b => b.onclick = async () => {
      if (!requireLogin()) return;
      try { const r = await api('api/reviews/' + b.dataset.rvote + '/vote', { method: 'POST' }); b.setAttribute('aria-pressed', r.voted); b.innerHTML = `${ic('i-thumb')} ${r.upvotes}`; } catch (e) { fail(e); }
    });
    $('reviewForm').onsubmit = e => {
      e.preventDefault();
      const t = $('rtext').value.trim();
      if (t.length < 3) { $('rsent').textContent = 'Write a few words before posting.'; $('rtext').focus(); return; }
      act('reviews', { body: t });
    };
    const more = $('moreReviews');
    if (more) more.onclick = () => { app.querySelectorAll('#reviewList .review[hidden]').forEach(li => { li.hidden = false; }); more.remove(); };
    const mineReview = (app.querySelector('#reviewList .review .small.muted') || {}).textContent === 'your review';
    if (mineReview) { $('rtext').placeholder = 'Update your review…'; app.querySelector('#reviewForm button[type=submit]').textContent = 'Update review'; }
    $('askAiBtn').onclick = () => { useResource(it.id).then(() => { ASSIST.tab = 'summary'; location.hash = '#assistant'; }); };
  }
  async function refreshMe() { try { const r = await api('api/auth/me'); S.me = r.signedIn ? r.user : null; renderUser(); } catch (e) { /* keep current */ } }

  /* ---------------- AI Study Assistant ---------------- */
  function aiStatusHTML() {
    const on = S.meta.ai.mode === 'claude';
    return `<span class="aistatus ${on ? 'on' : 'off'}" title="${on ? 'Answers are written by Claude via the server' : 'Set ANTHROPIC_API_KEY on the server to enable Claude'}"><i></i>${on ? 'Claude AI connected · ' + esc(S.meta.ai.model) : 'Offline AI mode (server)'}</span>`;
  }
  function renderAssistant() {
    app.innerHTML = `<div class="wrap appgrid">
      ${sideNav('assistant')}
      <div style="min-width:0">
        <div class="pagehead"><div><h1>AI Study Assistant</h1><p>Ask anything about your study material. Get instant summaries, key points, quizzes and answers.</p></div>${aiStatusHTML()}</div>
        <div class="card material">
          <span class="fic" style="background:${ASSIST.kind === 'PDF' ? 'var(--t-pdf)' : ASSIST.resId ? 'var(--accent)' : 'var(--t-article)'}">${esc(ASSIST.kind)}</span>
          <div class="grow"><div class="fname">${esc(ASSIST.name)}</div><div class="small muted">${ASSIST.resId ? 'GyaanSetu resource' : ASSIST.kind + ' · ' + fmt(ASSIST.size) + ' characters'}${ASSIST.sample ? ' · sample notes' : ''}</div></div>
          <div class="mact">
            <label class="btn primary sm" for="upl" style="cursor:pointer">${ic('i-upload')}Upload new file</label>
            <input type="file" id="upl" accept=".pdf,.txt,.md,.csv,.json" hidden>
            <button class="btn sm" type="button" id="pasteToggle">Paste text</button>
          </div>
          <div style="flex-basis:100%">
            <div class="srcpick"><select class="field" id="resPick" aria-label="Study a GyaanSetu resource"><option value="">Or study a GyaanSetu resource…</option></select><button class="btn sm" type="button" id="useSample">Use sample notes</button></div>
            <div class="pastebox" id="pasteBox" hidden><textarea class="field" id="pasteText" placeholder="Paste lecture notes, a textbook section or an article…"></textarea><button class="btn sm primary" type="button" id="usePaste" style="justify-self:start">Use this text</button></div>
            <div id="uplMsg" class="small muted" style="margin-top:6px">PDFs are read on the server with Apache PDFBox.</div>
          </div>
        </div>
        <div class="tabs" role="tablist">
          ${[['summary', 'Summary'], ['points', 'Key Points'], ['qa', 'Q&A'], ['quiz', 'Quiz']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${ASSIST.tab === k ? 'on' : ''}" aria-selected="${ASSIST.tab === k}">${l}</button>`).join('')}
        </div>
        <div class="card" id="aiPanel">${panelHTML()}</div>
      </div>
    </div>`;
    fillResPick();
    bindAssistant();
  }
  async function fillResPick() {
    try {
      const r = await api('api/resources?sort=best&limit=100');
      const sel = $('resPick'); if (!sel) return;
      sel.innerHTML = `<option value="">Or study a GyaanSetu resource…</option>` + r.items.map(x => `<option value="${esc(x.id)}" ${ASSIST.resId === x.id ? 'selected' : ''}>${esc(x.title)} (${esc(x.typeLabel)})</option>`).join('');
    } catch (e) { /* the picker stays empty */ }
  }
  function panelHTML() {
    const t = ASSIST.tab;
    if (t === 'qa') {
      return `<div class="aiout"><div class="chat" id="chat">${ASSIST.chat.length ? ASSIST.chat.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${m.role === 'user' ? esc(m.content) : md(m.content)}</div>`).join('') :
        `<p class="muted">Ask a question about <b>${esc(ASSIST.name)}</b>.</p><div class="suggests">${['What are the most important ideas here?', 'Explain this simply', 'Give me a real-world example'].map(s => `<button type="button" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
        ${ASSIST.busy ? `<div class="msg ai"><span class="thinking">${dots}Thinking…</span></div>` : ''}</div>
        ${ASSIST.qaNote ? `<p class="notice">${esc(ASSIST.qaNote)}</p>` : ''}</div>
        <form class="askbar" id="askForm"><input class="field" id="askIn" autocomplete="off" placeholder="Ask a question about this content…" aria-label="Ask a question"><button class="btn primary" ${ASSIST.busy ? 'disabled' : ''} aria-label="Send">${ic('i-send')}</button></form>`;
    }
    const o = ASSIST.out[t];
    const label = { summary: 'Summarise this material', points: 'Extract key points', quiz: 'Generate a quiz' }[t];
    let body;
    if (ASSIST.busy) body = `<span class="thinking">${dots}${S.meta.ai.mode === 'claude' ? 'Claude is reading your material…' : 'Analysing your material…'}</span>`;
    else if (!o) body = `<p class="muted">${t === 'quiz' ? 'Test yourself with multiple-choice questions built from your material.' : 'Get a clear, study-ready breakdown of your material.'}</p><button class="btn primary" type="button" id="runBtn" style="justify-self:start">${ic('i-ai')}${label}</button>`;
    else if (t === 'quiz') body = quizHTML(o) + `<button class="btn sm" type="button" id="runBtn" style="justify-self:start">${ic('i-spark')}New quiz</button>`;
    else body = `<div class="rowbetween"><h3 style="font-size:16px">${t === 'summary' ? 'Summary' : 'Key Points'}</h3><span class="small muted">${o.mode === 'claude' ? 'Written by Claude' : 'Offline extract'}</span></div>${md(o.text)}<button class="btn sm" type="button" id="runBtn" style="justify-self:start">${ic('i-spark')}Regenerate</button>`;
    return `<div class="aiout">${body}${o && o.message ? `<p class="notice">${esc(o.message)}</p>` : ''}</div>`;
  }
  function quizHTML(o) {
    const answered = o.items.filter(x => x.picked != null);
    return `<div class="rowbetween"><h3 style="font-size:16px">Quiz · ${o.items.length} questions</h3><span class="small muted">${o.mode === 'claude' ? 'Written by Claude' : 'Offline fill-in-the-blank'} · score ${answered.filter(x => x.picked === x.answer).length}/${answered.length}</span></div>
    <div class="quiz">${o.items.map((x, i) => `<div class="qitem"><div class="qq">${i + 1}. ${esc(x.q)}</div><div class="qopts">${x.options.map((op, j) => `<button type="button" data-qi="${i}" data-qj="${j}" ${x.picked != null ? 'disabled' : ''} class="${x.picked != null ? (j === x.answer ? 'right' : j === x.picked ? 'wrong' : '') : ''}">${String.fromCharCode(65 + j)}. ${esc(op)}</button>`).join('')}</div>${x.picked != null ? `<div class="qwhy">${x.picked === x.answer ? 'Correct.' : 'Not quite.'} ${esc(x.why || '')}</div>` : ''}</div>`).join('')}</div>`;
  }
  function repaintPanel() { if (S.view === 'assistant' && $('aiPanel')) { $('aiPanel').innerHTML = panelHTML(); bindPanel(); } }
  function bindAssistant() {
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { ASSIST.tab = b.dataset.tab; app.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); repaintPanel(); });
    $('upl').onchange = e => { const f = e.target.files[0]; if (f) uploadFile(f); e.target.value = ''; };
    $('pasteToggle').onclick = () => { $('pasteBox').hidden = !$('pasteBox').hidden; if (!$('pasteBox').hidden) $('pasteText').focus(); };
    $('usePaste').onclick = () => { const t = $('pasteText').value.trim(); if (t.length < 40) { $('uplMsg').textContent = 'Paste at least a few sentences.'; return; } setMaterial({ name: 'Pasted notes', kind: 'TXT', text: t }); };
    $('useSample').onclick = () => setMaterial({ name: 'Python_Basics_Notes.txt', kind: 'TXT', text: SAMPLE_NOTES, sample: true });
    $('resPick').onchange = e => { if (e.target.value) useResource(e.target.value).then(renderAssistant); };
    bindPanel();
  }
  function bindPanel() {
    const run = $('runBtn'); if (run) run.onclick = () => runTask(ASSIST.tab);
    const af = $('askForm'); if (af) af.onsubmit = e => { e.preventDefault(); ask($('askIn').value); };
    app.querySelectorAll('[data-suggest]').forEach(b => b.onclick = () => ask(b.dataset.suggest));
    app.querySelectorAll('[data-qi]').forEach(b => b.onclick = () => { ASSIST.out.quiz.items[+b.dataset.qi].picked = +b.dataset.qj; repaintPanel(); });
  }
  function setMaterial(m) {
    Object.assign(ASSIST, { name: m.name, kind: m.kind, text: m.text, size: m.text.length, resId: m.resId || null, sample: !!m.sample, out: {}, chat: [], qaNote: '' });
    if (S.view === 'assistant') renderAssistant();
    toast('Study material loaded.');
  }
  async function useResource(id) {
    try {
      const d = await api('api/resources/' + encodeURIComponent(id) + '?view=0');
      const it = d.item;
      const text = `${it.title}\nSource: ${it.source}\nType: ${it.typeLabel} · Level: ${it.level} · Subject: ${it.subjectName}\n\n${it.desc}\n\nTopics covered: ${it.tags.join(', ')}.\n\nWhat learners say: ${d.reviews.slice(0, 6).map(r => r.body).join(' ')}`;
      Object.assign(ASSIST, { name: it.title, kind: it.typeCode, text, size: text.length, resId: id, sample: false, out: {}, chat: [], qaNote: '' });
      toast('Study material loaded.');
    } catch (e) { fail(e); }
  }
  async function uploadFile(f) {
    const msg = $('uplMsg');
    if (f.size > 25 * 1024 * 1024) { msg.textContent = 'This file is larger than 25 MB. Try a smaller file.'; return; }
    msg.innerHTML = `<span class="thinking">${dots}Uploading and reading ${esc(f.name)} on the server…</span>`;
    const form = new FormData(); form.append('file', f);
    try {
      const r = await api('api/ai/upload', { method: 'POST', form });
      setMaterial({ name: r.name, kind: r.kind, text: r.text });
      if (r.truncated) toast('Long file: the first 60,000 characters are used.');
    } catch (e) { if ($('uplMsg')) $('uplMsg').textContent = e.message || 'Upload failed.'; }
  }
  async function runTask(t) {
    if (ASSIST.busy) return;
    ASSIST.busy = true; repaintPanel();
    try {
      const path = { summary: 'summary', points: 'keypoints', quiz: 'quiz' }[t];
      const r = await api('api/ai/' + path, { method: 'POST', body: { name: ASSIST.name, text: ASSIST.text } });
      if (t === 'quiz') r.items.forEach(x => x.picked = null);
      ASSIST.out[t] = r;
      if (r.mode === 'claude') refreshMe();
    } catch (e) { fail(e); }
    ASSIST.busy = false; repaintPanel();
  }
  async function ask(text) {
    const q = (text || '').trim(); if (!q || ASSIST.busy) return;
    ASSIST.chat.push({ role: 'user', content: q }); ASSIST.busy = true; ASSIST.qaNote = ''; repaintPanel();
    try {
      const r = await api('api/ai/ask', { method: 'POST', body: { name: ASSIST.name, text: ASSIST.text, messages: ASSIST.chat.slice(-10) } });
      ASSIST.chat.push({ role: 'assistant', content: r.text }); ASSIST.qaNote = r.message || '';
    } catch (e) { ASSIST.chat.pop(); fail(e); }
    ASSIST.busy = false; repaintPanel();
    const chat = $('chat'); if (chat && chat.lastElementChild) chat.lastElementChild.scrollIntoView({ block: 'nearest' });
    if ($('askIn')) $('askIn').focus({ preventScroll: true });
  }

  /* ---------------- Dashboard ---------------- */
  function signInCard(what) {
    return `<div class="card pad signin-card"><span class="avatar" style="width:52px;height:52px">${ic('i-user')}</span><h2 style="margin:0">Sign in to see your ${what}</h2><p class="muted">Your saved resources, study planner, search history and points are stored on the server for your account.</p><a class="btn primary" href="#login">Login / Sign up</a></div>`;
  }
  async function renderDashboard(seq) {
    if (!S.me) { app.innerHTML = `<div class="wrap appgrid">${sideNav('dashboard')}<div>${signInCard('dashboard')}</div></div>`; return; }
    app.innerHTML = loadingHTML('Loading your dashboard…');
    const d = await api('api/dashboard');
    if (seq !== renderSeq) return;
    const goalsDone = d.goals.filter(g => g.done).length;
    app.innerHTML = `<div class="wrap appgrid">
      ${sideNav('dashboard')}
      <div style="min-width:0">
        <div class="pagehead"><div><h1>${greeting()}, ${esc(d.user.name.split(' ')[0])}!</h1><p>Keep learning, keep growing.${d.user.guest ? ' You are browsing as a guest.' : ''}</p></div></div>
        <div class="stats">
          <div class="card stat" style="--c:var(--good)"><span class="ic">${ic('i-bookmark')}</span><div><b>${d.stats.saved}</b><span>Saved resources</span></div></div>
          <div class="card stat" style="--c:var(--accent)"><span class="ic">${ic('i-done')}</span><div><b>${d.stats.completed}</b><span>Completed</span></div></div>
          <div class="card stat" style="--c:var(--t-image)"><span class="ic">${ic('i-spark')}</span><div><b>${d.stats.subjects}</b><span>Subjects explored</span></div></div>
          <div class="card stat" style="--c:var(--warn)"><span class="ic">${ic('i-trophy')}</span><div><b>${d.stats.points}</b><span>Learning points</span></div></div>
        </div>
        <div class="dashgrid">
          <div class="card pad">
            <div class="sectionhead"><h2>Recent Searches</h2>${d.searches.length ? `<button class="btn ghost sm" type="button" id="clearSearches">Clear</button>` : ''}</div>
            ${d.searches.length ? `<ul class="list">${d.searches.map(s => `<li>${ic('i-search')}<span class="grow"><a class="link" href="#search?q=${encodeURIComponent(s.q)}">${esc(s.q)}</a></span><span class="small muted">${ago(s.at)}</span></li>`).join('')}</ul>` : `<p class="muted">Your searches will appear here. <a href="#home">Start searching</a></p>`}
          </div>
          <div class="card pad">
            <div class="sectionhead"><h2>Recommended for You</h2><a class="btn ghost sm" href="#search">View all</a></div>
            <ul class="list">${d.recommended.map(r => `<li>${typeTag(r.type)}<span class="grow"><a class="link" href="#resource/${encodeURIComponent(r.id)}">${esc(r.title)}</a></span><span class="small mono">${r.rating.toFixed(1)}★</span></li>`).join('')}</ul>
            <p class="small muted" style="margin-top:8px">${d.personalised ? 'Based on what you liked, saved, rated and completed.' : 'Like, save or rate resources to personalise these.'}</p>
          </div>
          <div class="card pad wide" id="library">
            <div class="sectionhead"><h2>My Library</h2><span class="small muted">${d.stats.saved} saved · ${d.stats.completed} completed</span></div>
            ${d.library.length ? `<div class="tiles">${d.library.map(tileHTML).join('')}</div>` : `<p class="muted">Save resources with the bookmark button and they will appear here.</p>`}
          </div>
          <div class="card pad" id="planner">
            <div class="sectionhead"><h2>Study Planner</h2><button class="btn sm" type="button" id="aiPlan">${ic('i-ai')}Plan my week with AI</button></div>
            <div class="progress" role="img" aria-label="${goalsDone} of ${d.goals.length} goals done"><i style="width:${d.goals.length ? goalsDone / d.goals.length * 100 : 0}%"></i></div>
            <p class="small muted" style="margin:6px 0 4px">${goalsDone} of ${d.goals.length} goals done this week</p>
            <ul class="list" id="goalList">${goalsHTML(d.goals)}</ul>
            <form class="addgoal" id="goalForm"><input class="field" id="goalText" maxlength="200" placeholder="Add a study goal…" aria-label="New goal"><select class="field" id="goalDay" aria-label="Day">${DAYS.map(x => `<option>${x}</option>`).join('')}</select><button class="btn primary">Add</button></form>
            <p class="small muted" id="planMsg" style="margin-top:6px"></p>
          </div>
          <div class="card pad" id="leaderboard">
            <div class="sectionhead"><h2>Leaderboard</h2><span class="small muted">All-time points</span></div>
            <ol class="list lb">${d.leaderboard.map(b => `<li class="${b.me ? 'me' : ''}"><span class="pos">${b.pos || '–'}</span><span class="avatar" style="background:${avColor(b.name)};width:28px;height:28px;font-size:11px">${esc(initials(b.name))}</span><span class="grow">${esc(b.name)}${b.me ? ' (you)' : ''}</span><span class="pts">${b.points} pts</span></li>`).join('')}</ol>
            <p class="small muted" style="margin-top:8px">Earn points: review +5, question +5, forum answer +5, complete +3, rate +2, goal done +1, AI study +1.</p>
          </div>
        </div>
      </div>
    </div>`;
    bindDashboard();
    const anchor = store.take('gs-anchor');
    if (anchor) { const el = $(anchor); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  }
  const goalsHTML = goals => goals.map(g => `<li class="goal ${g.done ? 'done' : ''}"><input type="checkbox" id="g-${g.id}" data-goal="${g.id}" ${g.done ? 'checked' : ''}><span class="day">${esc(g.day)}</span><label class="grow" for="g-${g.id}">${esc(g.text)}</label><button class="iconbtn" type="button" data-delgoal="${g.id}" aria-label="Delete goal">${ic('i-x')}</button></li>`).join('') || '<li class="muted">No goals yet. Add one below or let AI plan your week.</li>';
  function bindDashboard() {
    const cs = $('clearSearches');
    if (cs) cs.onclick = async () => { try { await api('api/dashboard/searches', { method: 'DELETE' }); toast('Search history cleared.'); route(); } catch (e) { fail(e); } };
    const reload = async msg => { toast(msg); await refreshMe(); route(); };
    app.querySelectorAll('[data-goal]').forEach(c => c.onchange = async () => { try { const r = await api('api/goals/' + c.dataset.goal, { method: 'PUT', body: { done: c.checked } }); reload(r.message); } catch (e) { fail(e); } });
    app.querySelectorAll('[data-delgoal]').forEach(b => b.onclick = async () => { try { const r = await api('api/goals/' + b.dataset.delgoal, { method: 'DELETE' }); reload(r.message); } catch (e) { fail(e); } });
    $('goalForm').onsubmit = async e => {
      e.preventDefault();
      const text = $('goalText').value.trim();
      if (text.length < 3) { $('goalText').focus(); toast('Write a goal of at least a few characters.', true); return; }
      try { const r = await api('api/goals', { method: 'POST', body: { text, day: $('goalDay').value } }); reload(r.message); } catch (e2) { fail(e2); }
    };
    $('aiPlan').onclick = async () => {
      const btn = $('aiPlan'); btn.disabled = true;
      $('planMsg').innerHTML = `<span class="thinking">${dots}Planning your week…</span>`;
      try {
        const r = await api('api/goals/plan', { method: 'POST' });
        $('goalList').innerHTML = goalsHTML(r.goals);
        bindDashboard();
        $('planMsg').textContent = r.message;
      } catch (e) { fail(e); $('planMsg').textContent = ''; }
      btn.disabled = false;
    };
  }

  /* ---------------- Community ---------------- */
  async function renderCommunity(threadId, seq) {
    app.innerHTML = loadingHTML();
    if (threadId) {
      const d = await api('api/threads/' + encodeURIComponent(threadId));
      if (seq !== renderSeq) return;
      const t = d.thread;
      app.innerHTML = `<div class="wrap appgrid">${sideNav('community')}<div style="min-width:0">
        <div class="pagehead"><div><h1>Community Forum</h1><p>Ask questions and learn from other students.</p></div><a class="btn" href="#community">${ic('i-back')}All discussions</a></div>
        <article class="card pad">
          <div class="tm" style="margin:0 0 8px"><span class="tag" style="--c:${(SUBJ[t.subject] || SUBJ.cs).color}">${esc(t.subjectName)}</span><span>${esc(t.author)}</span><span>${ago(t.createdAt)}</span><span>${t.votes} votes</span></div>
          <h2 style="font-size:20px;margin:0">${esc(t.title)}</h2>
          ${t.body ? `<p style="margin-top:8px">${esc(t.body)}</p>` : ''}
          <div class="answers">${d.answers.length ? d.answers.map(a => `<div class="answer ${a.ai ? 'ai' : ''}"><div class="ah"><span class="avatar" style="width:24px;height:24px;font-size:10px;background:${a.ai ? 'var(--accent)' : avColor(a.author)}">${a.ai ? 'AI' : esc(initials(a.author))}</span><b>${esc(a.author)}</b><span>${ago(a.createdAt)}</span>${a.ai ? '<span class="pill neu">AI-drafted</span>' : ''}</div>${md(a.body)}</div>`).join('') : '<p class="muted">No answers yet. Be the first to help.</p>'}</div>
          <form id="ansForm" style="display:grid;gap:10px;margin-top:16px">
            <label for="ansText"><b>Your answer</b></label>
            <textarea class="field" id="ansText" maxlength="2000" placeholder="Explain it the way you would to a friend…"></textarea>
            <div class="rowbetween"><button type="button" class="btn" id="aiAnswer">${ic('i-ai')}Draft an answer with AI</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="postAi" hidden>Post as AI answer</button><button class="btn primary">Post answer</button></span></div>
            <p class="small muted" id="ansMsg"></p>
          </form>
          ${d.related.length ? `<div style="margin-top:18px"><div class="eyebrow" style="margin-bottom:8px">Resources that may help</div><ul class="list">${d.related.map(r => `<li>${typeTag(r.type)}<span class="grow"><a class="link" href="#resource/${encodeURIComponent(r.id)}">${esc(r.title)}</a></span><span class="small mono">${Math.round(r.score)}</span></li>`).join('')}</ul></div>` : ''}
        </article>
      </div></div>`;
      bindThread(t);
      return;
    }
    const d = await api('api/threads');
    if (seq !== renderSeq) return;
    app.innerHTML = `<div class="wrap appgrid">${sideNav('community')}<div style="min-width:0">
      <div class="pagehead"><div><h1>Community Forum</h1><p>Ask questions and learn from other students. Stuck? Let AI draft an answer.</p></div></div>
      <form class="card pad" id="askThread" style="display:grid;gap:10px;margin-bottom:16px">
        <b>Ask a question</b>
        <input class="field" id="tTitle" maxlength="140" placeholder="What do you want to know?" aria-label="Question title">
        <textarea class="field" id="tBody" maxlength="1000" placeholder="Add details: what you tried, where you are stuck…" aria-label="Question details"></textarea>
        <div class="rowbetween"><select class="field" id="tSubj" style="width:auto" aria-label="Subject">${S.meta.subjects.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join('')}</select><button class="btn primary">Post question</button></div>
      </form>
      <div class="threads">${d.threads.map(t => `<article class="card thread">
        <div class="votes"><button type="button" data-tvote="${t.id}" aria-pressed="${t.voted}" aria-label="Upvote">${ic('i-up')}</button><b>${t.votes}</b></div>
        <div style="min-width:0"><h3><a href="#community/${t.id}">${esc(t.title)}</a></h3>${t.body ? `<p class="small muted" style="margin-top:4px">${esc(t.body)}</p>` : ''}
        <div class="tm"><span class="tag" style="--c:${(SUBJ[t.subject] || SUBJ.cs).color}">${esc(t.subjectName)}</span><span>${esc(t.author)}</span><span>${ago(t.createdAt)}</span><span>${t.answers} ${t.answers === 1 ? 'answer' : 'answers'}</span></div></div>
      </article>`).join('')}</div>
    </div></div>`;
    $('askThread').onsubmit = async e => {
      e.preventDefault();
      if (!requireLogin()) return;
      const title = $('tTitle').value.trim();
      if (title.length < 8) { $('tTitle').focus(); toast('Write a question of at least a few words.', true); return; }
      try { const r = await api('api/threads', { method: 'POST', body: { title, body: $('tBody').value.trim(), subject: $('tSubj').value } }); toast(r.message); refreshMe(); location.hash = '#community/' + r.thread.id; } catch (e2) { fail(e2); }
    };
    app.querySelectorAll('[data-tvote]').forEach(b => b.onclick = async () => {
      if (!requireLogin()) return;
      try { const r = await api('api/threads/' + b.dataset.tvote + '/vote', { method: 'POST' }); b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); b.nextElementSibling.textContent = r.votes; } catch (e) { fail(e); }
    });
  }
  function bindThread(t) {
    $('ansForm').onsubmit = async e => {
      e.preventDefault();
      if (!requireLogin()) return;
      const body = $('ansText').value.trim();
      if (body.length < 10) { $('ansMsg').textContent = 'Write a slightly longer answer.'; return; }
      try { const r = await api('api/threads/' + t.id + '/answers', { method: 'POST', body: { body, ai: false } }); toast(r.message); refreshMe(); route(); } catch (e2) { fail(e2); }
    };
    $('aiAnswer').onclick = async () => {
      if (!requireLogin()) return;
      const btn = $('aiAnswer'); btn.disabled = true;
      $('ansMsg').innerHTML = `<span class="thinking">${dots}Drafting…</span>`;
      try {
        const r = await api('api/threads/' + t.id + '/draft', { method: 'POST' });
        $('ansText').value = r.text;
        $('ansMsg').textContent = (r.mode === 'claude' ? 'Draft written by Claude. ' : '') + (r.message || 'Edit it, then post it as your answer or as an AI answer.');
        $('postAi').hidden = false;
      } catch (e) { fail(e); $('ansMsg').textContent = ''; }
      btn.disabled = false;
    };
    $('postAi').onclick = async () => {
      const body = $('ansText').value.trim();
      if (body.length < 10) return;
      try { const r = await api('api/threads/' + t.id + '/answers', { method: 'POST', body: { body, ai: true } }); toast(r.message); route(); } catch (e) { fail(e); }
    };
  }

  /* ---------------- Login / Sign up ---------------- */
  function renderLogin() {
    const signup = S.authTab === 'signup';
    app.innerHTML = `<div class="auth">
      <div class="authside">
        <h2>Learn <em>Smarter</em>,<br>Not Harder</h2>
        <ul><li>${ic('i-library')}Access quality resources</li><li>${ic('i-ai')}Get AI-powered suggestions</li><li>${ic('i-dash')}Track your progress</li></ul>
        <div class="art" aria-hidden="true">${loginArt()}</div>
      </div>
      <div class="authform">
        ${S.me ? `<div class="authcard card pad"><h2>Signed in as ${esc(S.me.name)}</h2><p class="muted">${esc(S.me.email || 'Guest account')}</p><div class="rowbetween"><a class="btn primary" href="#dashboard">Go to dashboard</a><button class="btn" type="button" id="logout2">Sign out</button></div></div>` : `
        <form class="authcard" id="authForm" novalidate>
          <div class="authtabs" role="tablist"><button type="button" role="tab" data-auth="login" class="${!signup ? 'on' : ''}" aria-selected="${!signup}">Login</button><button type="button" role="tab" data-auth="signup" class="${signup ? 'on' : ''}" aria-selected="${signup}">Sign Up</button></div>
          ${signup ? `<div class="fld"><label for="aName">Full name</label><input class="field" id="aName" autocomplete="name" placeholder="Enter your name"></div>` : ''}
          <div class="fld"><label for="aEmail">Email</label><input class="field" id="aEmail" type="email" autocomplete="username" placeholder="Enter your email"></div>
          <div class="fld"><label for="aPass">Password</label><input class="field" id="aPass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'At least 6 characters' : 'Enter your password'}"></div>
          <p class="small" id="aErr" style="color:var(--bad);min-height:1em" role="alert"></p>
          <button class="btn primary" style="padding:12px" id="authSubmit">${signup ? 'Create account' : 'Login'}</button>
          <div class="or">OR</div>
          <button type="button" class="btn" id="guestBtn">${ic('i-user')}Continue as guest</button>
          ${signup ? '' : `<div class="democred"><b>Demo account for judges:</b> <code>demo@gyaansetu.in</code> / <code>demo1234</code> <button type="button" class="btn ghost sm" id="fillDemo">Fill in</button></div>`}
          <p class="small muted" style="text-align:center">${signup ? 'Already have an account?' : "Don't have an account?"} <button type="button" class="btn ghost sm" data-auth="${signup ? 'login' : 'signup'}">${signup ? 'Login' : 'Sign up'}</button></p>
          <p class="small muted" style="text-align:center">Passwords are hashed on the server with PBKDF2 and never stored in plain text.</p>
        </form>`}
      </div>
    </div>`;
    app.querySelectorAll('[data-auth]').forEach(b => b.onclick = () => { S.authTab = b.dataset.auth; renderLogin(); });
    const lo = $('logout2'); if (lo) lo.onclick = () => $('logoutBtn') && $('logoutBtn').click();
    const fd = $('fillDemo'); if (fd) fd.onclick = () => { $('aEmail').value = 'demo@gyaansetu.in'; $('aPass').value = 'demo1234'; $('authSubmit').focus(); };
    const g = $('guestBtn'); if (g) g.onclick = async () => { try { const r = await api('api/auth/guest', { method: 'POST' }); afterLogin(r.user, 'Welcome! You are browsing as a guest.'); } catch (e) { $('aErr').textContent = e.message; } };
    const form = $('authForm'); if (!form) return;
    form.onsubmit = async e => {
      e.preventDefault();
      const err = $('aErr'); err.textContent = '';
      const email = $('aEmail').value.trim(), password = $('aPass').value, nameEl = $('aName');
      if (nameEl && nameEl.value.trim().length < 2) { err.textContent = 'Enter your name.'; nameEl.focus(); return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Enter a valid email address.'; $('aEmail').focus(); return; }
      if (password.length < (signup ? 6 : 1)) { err.textContent = signup ? 'Password must be at least 6 characters.' : 'Enter your password.'; $('aPass').focus(); return; }
      $('authSubmit').disabled = true;
      try {
        const r = await api('api/auth/' + (signup ? 'signup' : 'login'), { method: 'POST', body: signup ? { name: nameEl.value.trim(), email, password } : { email, password } });
        afterLogin(r.user, signup ? `Account created. Welcome, ${r.user.name.split(' ')[0]}!` : `Welcome back, ${r.user.name.split(' ')[0]}!`);
      } catch (e2) { err.textContent = e2.message; if ($('authSubmit')) $('authSubmit').disabled = false; }
    };
  }
  function afterLogin(user, msg) {
    S.me = user; renderUser(); toast(msg);
    const back = S.returnTo && S.returnTo !== '#login' ? S.returnTo : '#dashboard';
    S.returnTo = null;
    location.hash = back;
  }
  function loginArt() {
    return `<svg viewBox="0 0 340 230"><ellipse cx="170" cy="216" rx="140" ry="10" fill="#3346e0" opacity=".08"/>
    <rect x="70" y="170" width="200" height="40" rx="8" fill="#3346e0"/><rect x="78" y="178" width="184" height="8" rx="3" fill="#fff"/>
    <rect x="90" y="134" width="170" height="36" rx="8" fill="#fff" stroke="#dfe4ff" stroke-width="2"/><rect x="90" y="134" width="18" height="36" rx="5" fill="#6f80ff"/>
    <circle cx="170" cy="62" r="20" fill="#f3c7a6"/><path d="M150 58c0-16 10-22 20-22s22 6 20 24c-6-8-14-10-20-10s-14 2-20 8z" fill="#1a1f3d"/>
    <path d="M136 134c4-34 18-48 34-48s30 14 34 48z" fill="#3346e0"/>
    <rect x="128" y="110" width="84" height="26" rx="3" fill="#c9d0ea"/><rect x="134" y="114" width="72" height="18" rx="2" fill="#0f1733"/><circle cx="170" cy="123" r="3" fill="#8f9dff"/>
    <path d="M286 170c0-30 10-50 14-60M300 110c-12 2-20 10-22 20M300 130c10-2 18-10 20-20M296 150c-10 0-18-6-20-14" stroke="#2fb57d" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="278" y="168" width="30" height="42" rx="5" fill="#1d2b8a"/>
    <circle cx="60" cy="70" r="5" fill="#ffc847"/><circle cx="290" cy="50" r="3" fill="#ffc847"/><circle cx="40" cy="140" r="3" fill="#8f9dff"/>
    </svg>`;
  }

  /* ---------------- Global events and boot ---------------- */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-subject],[data-qtype],[data-save],[data-q],[data-action],[data-anchor],[data-from]');
    if (!el) return;
    const d = el.dataset;
    if (d.from) { S.fromResults = true; return; }
    if (d.anchor) { store.set('gs-anchor', d.anchor); if (location.hash === '#dashboard') { e.preventDefault(); route(); } return; }
    if (d.subject) { S.F = { types: new Set(), subject: d.subject, level: '', minRating: 0, minViews: 0, sort: 'best' }; search(''); return; }
    if (d.qtype) { const bq = $('bq'); search(bq ? bq.value : '', { types: [d.qtype] }); return; }
    if (d.q) { search(d.q); return; }
    if (d.action === 'resetF') { resetFilters(); return; }
    if (d.save) {
      if (!requireLogin()) return;
      try {
        const r = await api('api/resources/' + encodeURIComponent(d.save) + '/save', { method: 'POST' });
        el.setAttribute('aria-pressed', r.item.user.saved);
        el.setAttribute('aria-label', r.item.user.saved ? 'Remove from library' : 'Save to library');
        toast(r.message);
      } catch (e2) { fail(e2); }
    }
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#resource/"]');
    if (a && S.view !== 'detail') S.fromResults = S.view === 'results';
  }, true);
  $('hSearch').addEventListener('submit', e => { e.preventDefault(); search($('hq').value); $('hq').blur(); });
  let hqTimer;
  $('hq').addEventListener('input', () => {
    if (S.view !== 'results') return;
    clearTimeout(hqTimer);
    hqTimer = setTimeout(() => { S.query = $('hq').value.trim(); S.aiPath = null; history.replaceState(null, '', '#search' + (S.query ? '?q=' + encodeURIComponent(S.query) : '')); rerunResults(); }, 220);
  });
  window.addEventListener('hashchange', route);

  (async function boot() {
    app.innerHTML = loadingHTML('Connecting to GyaanSetu…');
    try {
      const [me, meta] = await Promise.all([api('api/auth/me'), api('api/meta')]);
      S.me = me.signedIn ? me.user : null;
      S.meta = meta;
      $('suggest').innerHTML = meta.suggestions.map(t => `<option value="${esc(t)}"></option>`).join('');
      renderUser();
      route();
    } catch (e) {
      app.innerHTML = `<div class="wrap"><div class="card empty" style="margin-top:40px">${ic('i-db')}<h3>Cannot reach the GyaanSetu server</h3><p class="muted">${esc(e.message)} Start it with <code>mvn compile exec:exec</code> and reload this page.</p><button class="btn primary" type="button" onclick="location.reload()">Reload</button></div></div>`;
    }
  })();
})();
