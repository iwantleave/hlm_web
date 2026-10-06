// 红楼知识库 · 应用逻辑（纯前端，无后端依赖）
(function () {
  "use strict";

  const DATA = window.HLM_DATA || {
    people: [], poems: [], judgments: [], plots: [], editions: []
  };

  const TYPES = [
    { key: "people",    label: "人物", desc: "金陵儿女，主子、丫鬟与方外之人，附小传与人物关系。" },
    { key: "poems",     label: "诗词", desc: "书中诗词曲赋，含《葬花吟》《枉凝眉》等名篇与赏析。" },
    { key: "judgments", label: "判词", desc: "金陵十二钗正册判词及解读，暗喻诸钗命运。" },
    { key: "plots",     label: "情节", desc: "经典情节脉络，标注回目与关联人物。" },
    { key: "editions",  label: "版本", desc: "脂评本与程高本等版本源流与特征。" }
  ];
  const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]));

  // 索引：id -> { type, item }，用于关联跳转
  const index = {};
  TYPES.forEach(t => (DATA[t.key] || []).forEach(it => { index[it.id] = { type: t.key, item: it }; }));

  // 反向索引：id -> [{type, id, title}]，用于人物页聚合「在本库中」
  const backlinks = {};
  function pushBack(id, entry) {
    if (!id) return;
    (backlinks[id] = backlinks[id] || []).push(entry);
  }
  (DATA.people || []).forEach(p => (p.relations || []).forEach(r => pushBack(r.to, { type: "people", id: p.id, title: p.name, via: r.type })));
  (DATA.plots || []).forEach(pl => (pl.related || []).forEach(id => pushBack(id, { type: "plots", id: pl.id, title: pl.title })));
  (DATA.judgments || []).forEach(j => (j.links || []).forEach(id => pushBack(id, { type: "judgments", id: j.id, title: j.title })));
  (DATA.poems || []).forEach(po => {
    if (!po.author) return;
    (DATA.people || []).forEach(p => {
      if (p.name && po.author.indexOf(p.name) >= 0) pushBack(p.id, { type: "poems", id: po.id, title: po.title });
    });
  });

  const app = document.getElementById("app");
  const sidebar = document.getElementById("sidebar");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const siteSubtitle = document.getElementById("site-subtitle");
  if (DATA.meta && DATA.meta.subtitle) siteSubtitle.textContent = DATA.meta.subtitle;

  const state = { type: "people", query: "" };

  function totalCount() {
    return TYPES.reduce((s, t) => s + (DATA[t.key] || []).length, 0);
  }
  function nameOf(id) {
    const e = index[id];
    return e ? (e.item.name || e.item.title || id) : id;
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function searchText(type, item) {
    const keys = ["name", "title", "alias", "identity", "description", "content",
      "annotation", "explanation", "character", "chapter", "fullName", "era", "features"];
    const parts = [];
    keys.forEach(k => {
      const v = item[k];
      if (!v) return;
      parts.push(Array.isArray(v) ? v.join(" ") : String(v));
    });
    return parts.join(" ").toLowerCase();
  }

  function renderNav() {
    sidebar.innerHTML = "";
    const navItems = [{ key: "all", label: "全部" }].concat(TYPES);
    navItems.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "nav-item" + (state.type === t.key ? " active" : "");
      const count = t.key === "all" ? totalCount() : (DATA[t.key] || []).length;
      btn.innerHTML = `<span>${t.label}</span><span class="nav-count">${count}</span>`;
      btn.addEventListener("click", () => { state.type = t.key; location.hash = "#/list/" + t.key; });
      sidebar.appendChild(btn);
    });
  }

  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    if (parts[0] === "detail" && parts[1] && parts[2]) {
      return { view: "detail", type: parts[1], id: decodeURIComponent(parts[2]) };
    }
    if (parts[0] === "list" && parts[1]) {
      return { view: "list", type: parts[1] };
    }
    return { view: "list", type: state.type };
  }

  function getList(type, query) {
    let list = [];
    if (type === "all") {
      TYPES.forEach(t => (DATA[t.key] || []).forEach(it => list.push({ type: t.key, item: it })));
    } else if (DATA[type]) {
      (DATA[type] || []).forEach(it => list.push({ type: type, item: it }));
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(e => searchText(e.type, e.item).includes(q));
    }
    return list;
  }

  function cardHTML(type, item) {
    const title = item.name || item.title || "（无题）";
    let sub = "";
    if (type === "people") sub = item.category || "";
    else if (type === "poems") sub = (item.author || "") + (item.chapter ? " · " + item.chapter : "");
    else if (type === "judgments") sub = item.character || "";
    else if (type === "plots") sub = item.chapter || "";
    else if (type === "editions") sub = (item.era || "");
    let desc = item.description || item.summary || item.explanation || item.content || "";
    if (desc.length > 90) desc = desc.slice(0, 90) + "…";
    return `<article class="card" data-type="${type}" data-id="${item.id}">
      <h3 class="card-title">${escapeHTML(title)}</h3>
      ${sub ? `<div class="card-sub">${escapeHTML(sub)}</div>` : ""}
      <p class="card-desc">${escapeHTML(desc)}</p>
    </article>`;
  }

  function renderList(route) {
    state.type = route.type || "people";
    renderNav();
    const list = getList(state.type, state.query);
    const info = state.type === "all"
      ? { label: "全部条目", desc: "红楼梦人物、诗词、判词、情节与版本总览。" }
      : TYPE_MAP[state.type];
    let html = `<h2 class="view-title">${state.type === "all" ? "全部条目" : info.label}</h2>`;
    html += `<p class="view-desc">${info.desc || ""}</p>`;
    html += `<p class="result-meta">共 ${list.length} 条${state.query ? `（搜索：“${escapeHTML(state.query)}”）` : ""}</p>`;
    if (list.length === 0) {
      html += `<div class="empty">未找到匹配的内容</div>`;
    } else {
      html += `<div class="card-grid">` + list.map(e => cardHTML(e.type, e.item)).join("") + `</div>`;
    }
    app.innerHTML = html;
    app.scrollTop = 0;
    app.querySelectorAll(".card").forEach(c => {
      c.addEventListener("click", () => {
        location.hash = `#/detail/${c.dataset.type}/${encodeURIComponent(c.dataset.id)}`;
      });
    });
  }

  function relChips(entries) {
    if (!entries || !entries.length) return "";
    const chips = entries.map(e => {
      const t = e.type ? `<span class="rel-type">${escapeHTML(e.type)}</span>` : "";
      return `<span class="rel-chip" data-id="${e.id}">${escapeHTML(nameOf(e.id))}${t}</span>`;
    }).join("");
    return `<div class="rel-list">${chips}</div>`;
  }

  function backLink() {
    return `<button class="back-link" id="back">← 返回列表</button>`;
  }

  /* ---------- 各模块详情版式 ---------- */

  function peopleDetail(item) {
    let h = `<header class="d-head">
      <h2>${escapeHTML(item.name)}</h2>
      ${item.alias && item.alias.length ? `<div class="d-alias">${item.alias.map(a => `<span class="tag">${escapeHTML(a)}</span>`).join("")}</div>` : ""}
      <div class="meta-row">${escapeHTML([item.category, item.identity].filter(Boolean).join(" · "))}</div>
    </header>`;
    h += `<div class="d-cols">
      <section class="d-bio">
        <h3 class="d-h">小传</h3>
        <div class="detail-body">${escapeHTML(item.description || "")}</div>
      </section>
      <aside class="d-rels">
        <h3 class="d-h">人物关系</h3>
        ${relChips((item.relations || []).map(r => ({ id: r.to, type: r.type })))}
      </aside>
    </div>`;
    const backs = backlinks[item.id] || [];
    if (backs.length) {
      const groups = { poems: [], plots: [], judgments: [] };
      backs.forEach(b => { if (groups[b.type]) groups[b.type].push(b); });
      const labelOf = { poems: "相关诗词", plots: "相关情节", judgments: "相关判词" };
      h += `<section class="d-links"><h3 class="d-h">在本库中</h3>`;
      ["poems", "plots", "judgments"].forEach(k => {
        if (groups[k].length) {
          const seen = {};
          const uniq = groups[k].filter(b => (seen[b.id] ? false : (seen[b.id] = true)));
          h += `<div class="d-link-row"><span class="d-link-label">${labelOf[k]}</span>${relChips(uniq.map(b => ({ id: b.id })))}</div>`;
        }
      });
      h += `</section>`;
    }
    return h;
  }

  function poemsDetail(item) {
    let h = `<div class="poem-sheet">
      <h2 class="poem-title">${escapeHTML(item.title)}</h2>
      <div class="meta-row">${escapeHTML([item.author, item.chapter].filter(Boolean).join(" · "))}</div>
      <div class="poem poem--sheet">${escapeHTML(item.content)}</div>
    </div>`;
    if (item.annotation) {
      h += `<section class="d-section"><h3 class="d-h">赏析</h3><div class="detail-body">${escapeHTML(item.annotation)}</div></section>`;
    }
    return h;
  }

  function judgmentsDetail(item) {
    let h = `<div class="judge-card">
      <div class="judge-char">${escapeHTML(item.character || "")}</div>
      <div class="poem judge-text">${escapeHTML(item.content)}</div>
    </div>`;
    if (item.explanation) {
      h += `<section class="d-section"><h3 class="d-h">解读</h3><div class="detail-body">${escapeHTML(item.explanation)}</div></section>`;
    }
    if (item.links && item.links.length) {
      h += `<section class="d-section"><h3 class="d-h">对应人物</h3>${relChips(item.links.map(id => ({ id })))}</section>`;
    }
    return h;
  }

  function plotsDetail(item) {
    const arr = DATA.plots || [];
    const i = arr.findIndex(p => p.id === item.id);
    const prev = i > 0 ? arr[i - 1] : null;
    const next = (i >= 0 && i < arr.length - 1) ? arr[i + 1] : null;
    let h = `<div class="chapter-head">
      <span class="chapter-no">${escapeHTML(item.chapter || "")}</span>
      <h2>${escapeHTML(item.title)}</h2>
    </div>`;
    if (item.summary) {
      h += `<section class="d-section"><h3 class="d-h">情节简介</h3><div class="detail-body">${escapeHTML(item.summary)}</div></section>`;
    }
    if (item.related && item.related.length) {
      h += `<section class="d-section"><h3 class="d-h">登场人物</h3>${relChips(item.related.map(id => ({ id })))}</section>`;
    }
    if (prev || next) {
      h += `<nav class="chapter-nav">`;
      h += prev
        ? `<span class="cn-link" data-type="plots" data-id="${prev.id}">← ${escapeHTML(prev.title)}</span>`
        : `<span class="cn-placeholder"></span>`;
      h += next
        ? `<span class="cn-link cn-next" data-type="plots" data-id="${next.id}">${escapeHTML(next.title)} →</span>`
        : `<span class="cn-placeholder"></span>`;
      h += `</nav>`;
    }
    return h;
  }

  function editionsDetail(item) {
    let h = `<h2>${escapeHTML(item.name)}</h2>
      <div class="meta-row">${escapeHTML([item.fullName, item.era].filter(Boolean).join(" · "))}</div>`;
    if (item.description) {
      h += `<section class="d-section"><h3 class="d-h">简介</h3><div class="detail-body">${escapeHTML(item.description)}</div></section>`;
    }
    if (item.features && item.features.length) {
      h += `<section class="d-section"><h3 class="d-h">版本特征</h3><div>${item.features.map(f => `<span class="tag">${escapeHTML(f)}</span>`).join(" ")}</div></section>`;
    }
    const all = DATA.editions || [];
    if (all.length) {
      h += `<section class="d-section"><h3 class="d-h">版本对照</h3><div class="table-wrap"><table class="cmp-table">
        <thead><tr><th>版本</th><th>年代</th><th>特征</th></tr></thead><tbody>`;
      all.forEach(e => {
        const cur = e.id === item.id ? ' class="cur"' : "";
        const tag = e.id === item.id ? ' <span class="cur-tag">当前</span>' : "";
        const feats = (e.features || []).map(f => `<span class="tag">${escapeHTML(f)}</span>`).join(" ");
        h += `<tr${cur}><td>${escapeHTML(e.name)}${tag}</td><td>${escapeHTML(e.era || "")}</td><td>${feats}</td></tr>`;
      });
      h += `</tbody></table></div></section>`;
    }
    return h;
  }

  function renderDetail(route) {
    const entry = index[route.id];
    if (!entry || entry.type !== route.type) {
      app.innerHTML = `<div class="empty">未找到该条目</div>` + backLink();
      bindBack();
      return;
    }
    const { type, item } = entry;
    let body = "";
    if (type === "people") body = peopleDetail(item);
    else if (type === "poems") body = poemsDetail(item);
    else if (type === "judgments") body = judgmentsDetail(item);
    else if (type === "plots") body = plotsDetail(item);
    else if (type === "editions") body = editionsDetail(item);
    app.innerHTML = backLink() + `<div class="detail detail--${type}">` + body + `</div>`;
    app.scrollTop = 0;
    bindBack();
    bindChips();
  }

  function bindBack() {
    const b = document.getElementById("back");
    if (b) b.addEventListener("click", () => { location.hash = "#/list/" + state.type; });
  }

  function bindChips() {
    app.querySelectorAll(".rel-chip, .cn-link").forEach(ch => {
      ch.addEventListener("click", () => {
        const id = ch.dataset.id;
        const e = index[id];
        if (e) location.hash = `#/detail/${e.type}/${encodeURIComponent(id)}`;
      });
    });
  }

  function render() {
    const route = parseHash();
    if (route.view === "detail") renderDetail(route);
    else renderList(route);
  }

  function runSearch() {
    state.query = searchInput.value.trim();
    searchClear.classList.toggle("show", state.query.length > 0);
    if (parseHash().view === "detail") {
      location.hash = "#/list/" + state.type; // 触发 hashchange 重渲染
    } else {
      renderList({ view: "list", type: state.type });
    }
  }

  searchInput.addEventListener("input", runSearch);
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    state.query = "";
    searchClear.classList.remove("show");
    if (parseHash().view === "detail") location.hash = "#/list/" + state.type;
    else renderList({ view: "list", type: state.type });
    searchInput.focus();
  });

  window.addEventListener("hashchange", render);

  if (!location.hash) location.hash = "#/list/people";
  renderNav();
  render();
})();
