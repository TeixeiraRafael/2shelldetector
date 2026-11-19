(() => {
  'use strict';

  const MESSAGES = window.TWOSHELL_MESSAGES || ['Good news, {x} is not a known CVE (yet).'];
  const LOADING = window.TWOSHELL_LOADING || ['Searching...'];
  const COUSINS = window.TWOSHELL_COUSINS || {};
  const DEMO_WORDS = ['php', 'react', 'toaster', 'excel', 'kubernetes', 'notepad', 'wordpress', 'printer', 'fridge', 'blockchain'];
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel) => document.querySelector(sel);
  const app = $('#app');
  const form = $('#searchForm');
  const input = $('#q');
  const logoTerm = $('#logoTerm');
  const statusEl = $('#status');
  const verdictEl = $('#verdict');
  const tabsEl = $('#tabs');
  const resultsEl = $('#results');

  const SOURCES = {
    wiki: { label: 'Wikipedia', badge: 'W', kind: 'wiki' },
    hn: { label: 'Hacker News', badge: 'Y', kind: 'news' },
    gh: { label: 'GitHub', badge: 'GH', kind: 'code' },
  };
  const TABS = [['all', 'All'], ['news', 'News'], ['code', 'Code'], ['wiki', 'Wiki']];

  const LEVELS = [
    null,
    { label: 'Unconfirmed sighting', text: 'Someone, somewhere, typed it. Could be a real bug, could be a joke repo. Stay alert, stay caffeinated.' },
    { label: 'Credible chatter', text: 'Multiple corners of the internet are talking about it. Your vendor is already drafting a blog post.' },
    { label: 'Confirmed', text: 'It has CVEs, threads and almost certainly a logo. Time to check your versions.' },
    { label: 'Full-blown 2shell', text: 'CVEs, PoCs, think pieces, the works. Patch now, panic later, cancel your weekend.' },
  ];

  let currentRun = 0;
  let lastMessageIdx = -1;
  let tickTimer = null;
  let loadingTimer = null;
  let demoTimer = null;
  let state = null;

  // ---------- helpers ----------

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const compact = (term) => term.replace(/\s+/g, '');

  function normalizeTerm(raw) {
    return String(raw || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\s_-]*2[\s_-]*shell\s*$/i, '') // people will type "php2shell" anyway
      .slice(0, 40)
      .trim();
  }

  // Matches "php2shell", "PHP2Shell", "php-2-shell", "php 2shell" but not "xphp2shell".
  function buildMatcher(term, flags = 'iu') {
    const body = term.split(/[\s_-]+/).filter(Boolean).map(escapeRe).join('[\\s_.-]?');
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}[\\s_-]?2[\\s_-]?shell`, flags);
  }

  function stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function breadcrumb(u) {
    try {
      const url = new URL(u);
      const parts = url.pathname.split('/').filter(Boolean).slice(0, 2).map((p) => {
        try { return decodeURIComponent(p); } catch { return p; }
      });
      return [url.hostname.replace(/^www\./, ''), ...parts].join(' › ');
    } catch {
      return '';
    }
  }

  function fmtDate(d) {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtNum(n) {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  }

  function fmtElapsed(ms) {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // Wraps every "<term>2shell" in <mark>, without ever touching innerHTML.
  function highlight(text, term) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of String(text).matchAll(buildMatcher(term, 'giu'))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      frag.append(el('mark', { text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }

  async function getJSON(url, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function describeError(err) {
    if (err && (err.status === 403 || err.status === 429)) return 'rate-limited';
    if (err && err.name === 'AbortError') return 'timed out';
    return 'unreachable';
  }

  // ---------- sources ----------

  async function searchHN(term) {
    const re = buildMatcher(term);
    const q = encodeURIComponent(`${compact(term)}2shell`);
    const data = await getJSON(`https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=50`);
    const seen = new Set();
    return (data.hits || [])
      .map((h) => ({ ...h, story: stripHtml(h.story_text) }))
      .filter((h) => re.test(`${h.title || ''} ${h.url || ''} ${h.story}`))
      .filter((h) => {
        const key = h.url || h.objectID;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 12)
      .map((h) => {
        const discussion = `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`;
        return {
          source: 'hn',
          title: h.title || '(untitled)',
          url: safeUrl(h.url) || discussion,
          snippet: h.story.length > 240 ? `${h.story.slice(0, 240)}...` : h.story,
          meta: [`▲ ${fmtNum(h.points || 0)} points`, `${fmtNum(h.num_comments || 0)} comments`, fmtDate(h.created_at)].filter(Boolean),
          extra: h.url ? { label: 'HN discussion', url: discussion } : null,
          text: `${h.title || ''} ${h.story}`,
        };
      });
  }

  async function searchGitHub(term) {
    const re = buildMatcher(term);
    const q = encodeURIComponent(`${compact(term)}2shell`);
    const data = await getJSON(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`);
    return (data.items || [])
      .filter((r) => re.test(`${r.full_name} ${r.description || ''} ${(r.topics || []).join(' ')}`))
      .slice(0, 10)
      .map((r) => ({
        source: 'gh',
        title: r.full_name,
        url: safeUrl(r.html_url),
        snippet: r.description || 'No description. Very mysterious. Very hacker.',
        meta: [`★ ${fmtNum(r.stargazers_count || 0)}`, r.language, `updated ${fmtDate(r.pushed_at)}`].filter(Boolean),
        text: `${r.full_name} ${r.description || ''}`,
      }));
  }

  async function searchWiki(term) {
    const re = buildMatcher(term);
    const q = encodeURIComponent(`"${compact(term)}2shell"`);
    const data = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=8&format=json&origin=*`);
    return ((data.query && data.query.search) || [])
      .map((p) => ({ ...p, plain: stripHtml(p.snippet) }))
      .filter((p) => re.test(`${p.title} ${p.plain}`))
      .slice(0, 4)
      .map((p) => ({
        source: 'wiki',
        title: p.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        snippet: `...${p.plain}...`,
        meta: [`${fmtNum(p.wordcount || 0)} words`, `edited ${fmtDate(p.timestamp)}`],
        text: `${p.title} ${p.plain}`,
      }));
  }

  async function lookupCVE(id, attempt = 0) {
    let data;
    try {
      data = await getJSON(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(id)}`, 25000); // NVD is often slow (10s+)
    } catch (err) {
      // NVD rate-limits bursts (about 5 requests per 30s) and its refusal has no CORS header,
      // so it shows up as a network error. Wait a bit and try once more.
      if (attempt >= 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 7000));
      return lookupCVE(id, attempt + 1);
    }
    const cve = data.vulnerabilities && data.vulnerabilities[0] && data.vulnerabilities[0].cve;
    if (!cve) return null;
    const m = cve.metrics || {};
    const metric = (m.cvssMetricV40 || m.cvssMetricV31 || m.cvssMetricV30 || m.cvssMetricV2 || [])[0];
    const d = metric && metric.cvssData;
    return {
      score: d && d.baseScore,
      severity: (d && d.baseSeverity) || (metric && metric.baseSeverity),
      rejected: cve.vulnStatus === 'Rejected',
    };
  }

  function extractCVEs(items) {
    const counts = new Map();
    for (const it of items) {
      for (const m of (it.text || '').matchAll(/CVE-\d{4}-\d{4,7}/gi)) {
        const id = m[0].toUpperCase();
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  }

  const SEARCHERS = { wiki: searchWiki, hn: searchHN, gh: searchGitHub };

  // ---------- logo ----------

  function stopDemo() {
    clearTimeout(demoTimer);
    demoTimer = null;
  }

  function startDemo() {
    stopDemo();
    if (REDUCED_MOTION) {
      logoTerm.textContent = DEMO_WORDS[0];
      return;
    }
    let w = 0;
    let i = 0;
    let deleting = false;
    const step = () => {
      const word = DEMO_WORDS[w];
      if (!deleting && i === word.length) {
        deleting = true;
        demoTimer = setTimeout(step, 1500);
        return;
      }
      if (deleting && i === 0) {
        deleting = false;
        w = (w + 1) % DEMO_WORDS.length;
      }
      i += deleting ? -1 : 1;
      logoTerm.textContent = DEMO_WORDS[w].slice(0, i);
      demoTimer = setTimeout(step, deleting ? 55 : 110);
    };
    step();
  }

  function updateLogo() {
    const t = normalizeTerm(input.value);
    if (t) {
      stopDemo();
      logoTerm.textContent = t;
    } else if (app.classList.contains('is-home')) {
      if (!demoTimer) startDemo();
    } else {
      logoTerm.textContent = '';
    }
  }

  // ---------- rendering ----------

  function clearTimers() {
    clearInterval(tickTimer);
    clearInterval(loadingTimer);
    tickTimer = loadingTimer = null;
  }

  function resetResults() {
    clearTimers();
    verdictEl.hidden = true;
    verdictEl.className = 'verdict';
    verdictEl.replaceChildren();
    tabsEl.hidden = true;
    tabsEl.replaceChildren();
    resultsEl.replaceChildren();
  }

  function renderStatus(term) {
    const line = el('p', { class: 'loading-line', text: LOADING[0] });
    const chips = el('div', { class: 'chips' });
    const chipEls = {};
    for (const [key, src] of Object.entries(SOURCES)) {
      chipEls[key] = el('span', { class: 'chip chip--loading' }, el('span', { class: 'chip-dot', 'aria-hidden': 'true' }), el('span', { class: 'chip-label', text: `${src.label} · searching` }));
      chips.append(chipEls[key]);
    }
    statusEl.replaceChildren(line, chips);
    let n = 0;
    loadingTimer = setInterval(() => {
      n = (n + 1) % LOADING.length;
      line.textContent = LOADING[n];
    }, 1300);
    statusEl.dataset.term = term;
    return { line, chipEls };
  }

  function setChip(chip, label, ok) {
    chip.className = `chip ${ok ? 'chip--ok' : 'chip--err'}`;
    chip.querySelector('.chip-label').textContent = label;
  }

  // replaceChildren() would print null as the text "null", so drop optional blocks first.
  function setVerdict(...nodes) {
    verdictEl.replaceChildren(...nodes.filter(Boolean));
  }

  function pickMessage() {
    if (MESSAGES.length < 2) return MESSAGES[0];
    let i;
    do i = Math.floor(Math.random() * MESSAGES.length);
    while (i === lastMessageIdx);
    lastMessageIdx = i;
    return MESSAGES[i];
  }

  function fillMessage(template, term) {
    return template.replaceAll('{x}', `${term}2shell`).replaceAll('{t}', term);
  }

  function googleUrl(term) {
    return `https://www.google.com/search?q=${encodeURIComponent(`"${compact(term)}2shell"`)}`;
  }

  function copyButton(labelOk) {
    const btn = el('button', { type: 'button', class: 'btn', text: '🔗 Copy link' });
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        btn.textContent = labelOk;
      } catch {
        btn.textContent = 'Copy failed. The URL bar is right there, though.';
      }
      setTimeout(() => { btn.textContent = '🔗 Copy link'; }, 2200);
    });
    return btn;
  }

  function cousinLine(term, before, after) {
    const cousin = COUSINS[term.toLowerCase()];
    if (!cousin) return null;
    return el('p', { class: 'verdict-cousin' },
      before,
      el('a', { href: `https://nvd.nist.gov/vuln/detail/${cousin.cve}`, target: '_blank', rel: 'noopener noreferrer', text: `${cousin.name} (${cousin.cve})` }),
      after);
  }

  function renderSafe(term, failed) {
    const joke = el('h2', { class: 'verdict-joke' }, highlight(fillMessage(pickMessage(), term), term));
    const checkedAt = Date.now();

    const again = el('button', { type: 'button', class: 'btn btn--primary', text: '🔁 Check again' });
    again.addEventListener('click', () => runSearch(term, { push: false }));
    const updateAgain = () => {
      const ms = Date.now() - checkedAt;
      again.textContent = ms >= 180000
        ? '🔁 It has been a few minutes. Check again?'
        : `🔁 Check again · last checked ${fmtElapsed(ms)} ago`;
    };
    updateAgain();
    tickTimer = setInterval(updateAgain, 1000);

    const reroll = el('button', { type: 'button', class: 'btn', text: '🎲 Reassure me again' });
    reroll.addEventListener('click', () => {
      joke.replaceChildren(highlight(fillMessage(pickMessage(), term), term));
    });

    verdictEl.className = 'verdict verdict--safe';
    setVerdict(
      el('div', { class: 'verdict-head' },
        el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: '😌' }),
        el('p', { class: 'verdict-kicker', text: 'No 2shell detected' })),
      joke,
      cousinLine(term, `No ${term}2shell, but its famous cousin `, ' sends its regards 👋'),
      failed.length
        ? el('p', { class: 'verdict-note', text: `Heads up: ${failed.map((k) => SOURCES[k].label).join(' and ')} did not answer, so this all-clear is even less official than usual.` })
        : null,
      el('div', { class: 'verdict-actions' },
        again,
        reroll,
        copyButton('Copied! Spread the relief.'),
        el('a', { class: 'btn', href: googleUrl(term), target: '_blank', rel: 'noopener noreferrer', text: 'Google it anyway ↗' })),
    );
    verdictEl.hidden = false;
  }

  function renderOffline(term) {
    const retry = el('button', { type: 'button', class: 'btn btn--primary', text: '🔁 Try again' });
    retry.addEventListener('click', () => runSearch(term, { push: false }));
    verdictEl.className = 'verdict verdict--warn';
    setVerdict(
      el('div', { class: 'verdict-head' },
        el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: '🔌' }),
        el('p', { class: 'verdict-kicker', text: 'Could not reach the internet' })),
      el('h2', { class: 'verdict-joke', text: 'None of our sources answered. On the bright side, a computer with no internet is the most secure computer.' }),
      el('div', { class: 'verdict-actions' },
        retry,
        el('a', { class: 'btn', href: googleUrl(term), target: '_blank', rel: 'noopener noreferrer', text: 'Google it instead ↗' })),
    );
    verdictEl.hidden = false;
  }

  function renderFound(term, items, results, run) {
    const sourcesHit = Object.values(results).filter((list) => list.length).length;
    const cves = extractCVEs(items);
    // One joke repo mentioning a CVE is not "credible"; the CVE bonus needs two sources agreeing.
    const score = Math.min(4, sourcesHit + (cves.length && sourcesHit >= 2 ? 1 : 0));
    const level = LEVELS[score] || LEVELS[1];

    const meter = el('div', { class: 'meter', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '4', 'aria-valuenow': String(score), 'aria-label': 'Shell-o-meter' },
      el('span', { class: 'meter-name', text: 'Shell-o-meter' }),
      el('span', { class: 'meter-bar', 'aria-hidden': 'true' },
        [1, 2, 3, 4].map((i) => el('span', { class: `meter-seg${i <= score ? ' is-on' : ''}` }))),
      el('span', { class: 'meter-label', text: level.label }));

    let cveBox = null;
    if (cves.length) {
      cveBox = el('div', { class: 'cves' }, el('span', { class: 'cves-label', text: 'Related CVEs' }));
      for (const id of cves) {
        const score = el('span', { class: 'cve-score', text: '...' });
        cveBox.append(el('a', { class: 'cve-chip', href: `https://nvd.nist.gov/vuln/detail/${id}`, target: '_blank', rel: 'noopener noreferrer' }, el('span', { text: id }), score));
        lookupCVE(id)
          .then((info) => {
            if (run !== currentRun) return;
            if (info && info.score != null) {
              score.textContent = `${info.score} ${info.severity || ''}`.trim();
              score.dataset.sev = String(info.severity || '').toLowerCase();
            } else if (info && info.rejected) {
              score.textContent = 'rejected (duplicate?)';
            } else {
              score.textContent = 'not scored yet';
            }
          })
          .catch(() => { if (run === currentRun) score.textContent = 'NVD busy, click for details'; });
      }
    }

    verdictEl.className = 'verdict verdict--found';
    setVerdict(
      el('div', { class: 'verdict-head' },
        el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: '🚨' }),
        el('p', { class: 'verdict-kicker', text: '2shell detected' })),
      el('h2', { class: 'verdict-title' }, el('mark', { text: `${term}2shell` }), ' is a thing.'),
      meter,
      el('p', { class: 'verdict-text', text: level.text }),
      score <= 2 ? cousinLine(term, 'Pretty sure you are thinking of its famous cousin ', ' 👋') : null,
      cveBox,
      el('div', { class: 'verdict-actions' },
        el('a', { class: 'btn btn--primary', href: googleUrl(term), target: '_blank', rel: 'noopener noreferrer', text: 'Google it ↗' }),
        copyButton('Copied! Spread the panic.')),
    );
    verdictEl.hidden = false;

    state = { term, items, activeTab: 'all' };
    renderTabs();
    renderResults();
  }

  function renderTabs() {
    const counts = { all: state.items.length };
    for (const it of state.items) {
      const kind = SOURCES[it.source].kind;
      counts[kind] = (counts[kind] || 0) + 1;
    }
    tabsEl.replaceChildren(...TABS.filter(([key]) => counts[key]).map(([key, label]) => {
      const btn = el('button', { type: 'button', class: `tab${state.activeTab === key ? ' is-active' : ''}`, 'aria-pressed': String(state.activeTab === key) },
        label, el('span', { class: 'tab-count', text: String(counts[key]) }));
      btn.addEventListener('click', () => {
        state.activeTab = key;
        renderTabs();
        renderResults();
      });
      return btn;
    }));
    tabsEl.hidden = false;
  }

  function resultItem(it, term) {
    const src = SOURCES[it.source];
    return el('li', { class: 'result' },
      el('div', { class: 'result-source' },
        el('span', { class: `badge badge--${it.source}`, 'aria-hidden': 'true', text: src.badge }),
        el('span', { class: 'result-site' },
          el('span', { class: 'result-site-name', text: src.label }),
          el('span', { class: 'result-crumb', text: breadcrumb(it.url) }))),
      el('a', { class: 'result-title', href: it.url, target: '_blank', rel: 'noopener noreferrer' }, highlight(it.title, term)),
      it.snippet ? el('p', { class: 'result-snippet' }, highlight(it.snippet, term)) : null,
      el('p', { class: 'result-meta' },
        it.meta.join(' · '),
        it.extra ? [' · ', el('a', { href: it.extra.url, target: '_blank', rel: 'noopener noreferrer', text: it.extra.label })] : null));
  }

  function renderResults() {
    const { items, activeTab, term } = state;
    const list = activeTab === 'all' ? items : items.filter((i) => SOURCES[i.source].kind === activeTab);
    resultsEl.replaceChildren(
      ...list.map((it) => resultItem(it, term)),
      el('li', { class: 'results-more' },
        'Hungry for more doom? ',
        el('a', { href: googleUrl(term), target: '_blank', rel: 'noopener noreferrer', text: `Search Google for "${compact(term)}2shell" ↗` })),
    );
  }

  // Wikipedia first, then alternate news and code so it reads like one result page.
  function interleave(results) {
    const out = [...results.wiki];
    const a = results.hn;
    const b = results.gh;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out.filter((it) => it.url);
  }

  // ---------- flow ----------

  function syncUrl(term, push) {
    const url = new URL(location.href);
    url.searchParams.set('q', term);
    if (url.href === location.href) return;
    history[push ? 'pushState' : 'replaceState']({ q: term }, '', url);
  }

  async function runSearch(rawTerm, { push = true } = {}) {
    const term = normalizeTerm(rawTerm);
    input.value = term;
    if (!term) {
      input.value = '';
      input.placeholder = 'You need a thing in front of the 2shell. That is the whole bit.';
      input.focus();
      return;
    }

    const run = ++currentRun;
    stopDemo();
    app.classList.remove('is-home');
    app.classList.add('is-results');
    updateLogo();
    syncUrl(term, push);
    document.title = `${term}2shell? · 2shelldetector`;
    resetResults();
    const { chipEls } = renderStatus(term);

    const keys = Object.keys(SEARCHERS);
    const settled = await Promise.allSettled(keys.map((key) =>
      SEARCHERS[key](term).then(
        (list) => {
          if (run === currentRun) setChip(chipEls[key], `${SOURCES[key].label} · ${list.length} hit${list.length === 1 ? '' : 's'}`, true);
          return list;
        },
        (err) => {
          if (run === currentRun) setChip(chipEls[key], `${SOURCES[key].label} · ${describeError(err)}`, false);
          throw err;
        },
      )));
    if (run !== currentRun) return;

    clearInterval(loadingTimer);
    loadingTimer = null;
    statusEl.querySelector('.loading-line').textContent = 'Scan complete.';

    const results = {};
    const failed = [];
    keys.forEach((key, i) => {
      if (settled[i].status === 'fulfilled') results[key] = settled[i].value;
      else {
        results[key] = [];
        failed.push(key);
      }
    });

    const items = interleave(results);
    if (failed.length === keys.length) renderOffline(term);
    else if (!items.length) renderSafe(term, failed);
    else renderFound(term, items, results, run);
  }

  // ---------- wiring ----------

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(input.value);
  });

  input.addEventListener('input', updateLogo);

  $('#try').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-q]');
    if (btn) runSearch(btn.dataset.q);
  });

  window.addEventListener('popstate', () => {
    const q = new URL(location.href).searchParams.get('q');
    if (q) runSearch(q, { push: false });
    else location.reload();
  });

  const initial = new URL(location.href).searchParams.get('q');
  if (initial) runSearch(initial, { push: false });
  else startDemo();
})();
