/* =============================================================================
 * IVL 模拟器 · 角色创建流程（demo6 原样移植）
 * 交互/视觉完全照搬 demo6「俱乐部签约」四步：建档 → 定位 → 身份 → 天赋。
 * 数值来源仍为引擎（engine.js 的 E.Player），保证与蒙特卡洛同源；
 * 完成「签约」后 resolve 出一个已构建好的 E.Player 交给主流程。
 *
 *   window.IVLChargen.run()  ->  Promise<{ player, role, identityName }>
 * ===========================================================================*/
(function () {
  // 定位：demo6 内部键 -> 引擎中文键
  const ROLE_CN = { survivor: "求生者", hunter: "监管者" };
  // 身份：demo6 内部键 -> 引擎身份键（屠皇/人皇引擎统一为「人皇」，称号随定位）
  const ID_ENGINE = { rookie: "青训", streamer: "主播", king: "人皇" };

  // 身份选项（文案随定位变化：求生者=人皇 / 监管者=屠皇），与 demo6 一致
  const IDENTITIES = {
    survivor: [
      { key: "rookie", name: "青训选手", desc: "各项属性均衡。开局首个训练周期额外获得 2 次训练机会" },
      { key: "streamer", name: "人气主播", desc: "初始人气高、资金多。首个赛年的队内选拔获得扶持" },
      { key: "king", name: "榜前人皇", desc: "操作天赋型，初始技术很高，开局即战力" },
    ],
    hunter: [
      { key: "rookie", name: "青训选手", desc: "各项属性均衡。开局首个训练周期额外获得 2 次训练机会" },
      { key: "streamer", name: "人气主播", desc: "初始人气高、资金多。首个赛年的队内选拔获得扶持" },
      { key: "king", name: "榜前屠皇", desc: "操作天赋型，初始技术很高，开局即战力" },
    ],
  };

  // 天赋面板属性行（demo6 七行布局；数值取自引擎 Player）
  const ATTR_ROWS = [
    { k: "appearance", name: "容貌", note: "全程固定", suffix: "" },
    { k: "phys", name: "体能", note: "体力上限", suffix: "" },
    { k: "tech", name: "技术", note: "得分核心", suffix: "" },
    { k: "tac", name: "战术", note: "运营核心", suffix: "" },
    { k: "stab", name: "稳定性", note: "关键场心态", suffix: "" },
    { k: "pop", name: "人气", note: "粉丝/应援", suffix: " 万" },
    { k: "money", name: "资金", note: "商店货币", suffix: " G" },
  ];

  const STEPS = [
    { title: "建立选手档案" },
    { title: "选择你的定位" },
    { title: "选择出道身份" },
    { title: "天赋检定" },
  ];

  const TEMPLATE = `
    <div class="app">
      <div class="hero">
        <div class="crest">IVL</div>
        <div class="ey">PROFESSIONAL CONTRACT</div>
        <h1>签约加入战队</h1>
        <p>欢迎来到 IVL。完成四步签约手续，你的职业生涯将正式开始</p>
        <div class="track" id="cctrack">
          <div class="p" data-i="0"><span class="n">1</span>建档</div><div class="sep"></div>
          <div class="p" data-i="1"><span class="n">2</span>定位</div><div class="sep"></div>
          <div class="p" data-i="2"><span class="n">3</span>身份</div><div class="sep"></div>
          <div class="p" data-i="3"><span class="n">4</span>天赋</div>
        </div>
      </div>
      <div class="card">
        <div class="ch"><span class="bar"></span><h2 id="cctitle">建立选手档案</h2></div>
        <div class="cguide" id="ccguide"></div>
        <div id="cccontent"></div>
        <div class="foot">
          <button class="btn btn-back" id="ccback" style="visibility:hidden">← 上一步</button>
          <span class="tip" id="cctip"></span>
          <button class="btn btn-go" id="ccnext" disabled>下一步 →</button>
        </div>
      </div>
    </div>
    <div class="modal" id="ccmodal">
      <div class="mc">
        <div class="seal">✓</div>
        <h3>签约完成</h3>
        <div class="bn" id="ccbn">MRC_XiaoD</div>
        <div class="sum" id="ccsum"></div>
        <button class="btn btn-go" id="ccclose" style="width:100%">开启职业生涯 →</button>
      </div>
    </div>`;

  function run() {
    return new Promise((resolve) => {
      const E = window.IVL;
      const cc = document.getElementById("cc");
      cc.innerHTML = TEMPLATE;
      cc.classList.add("show");
      const $ = (id) => cc.querySelector("#" + id);

      const state = { step: 0, team: "", pid: "", role: null, identity: null, player: null };
      const valid = (i) =>
        i === 0 ? !!(state.team && state.pid) :
        i === 1 ? !!state.role :
        i === 2 ? !!state.identity :
        !!state.player;

      function roll() {
        state.player = new E.Player(
          ID_ENGINE[state.identity],
          state.team || "MRC",
          state.pid || "无名选手",
          ROLE_CN[state.role]
        );
      }

      function render() {
        cc.querySelectorAll("#cctrack .p").forEach((p) => {
          const i = +p.dataset.i;
          p.classList.toggle("on", i === state.step);
          p.classList.toggle("ok", i < state.step && valid(i));
        });
        $("cctitle").textContent = STEPS[state.step].title;
        $("ccguide").style.display = "none";
        const c = $("cccontent");
        c.innerHTML = "";

        if (state.step === 0) {
          c.innerHTML = `<div class="fieldrow">
            <div class="field"><label class="lab">队伍名称（≤8字）</label><input class="inp" id="ccteam" maxlength="8" placeholder="例：MRC" value="${state.team}"></div>
            <div class="field"><label class="lab">选手 ID（≤12字）</label><input class="inp" id="ccpid" maxlength="12" placeholder="例：XiaoD" value="${state.pid}"></div></div>
            <div class="signrow"><div class="badge">ID</div><div><div class="k">登记在册的完整选手 ID</div><div class="v" id="ccfullid"></div></div></div>`;
          const upd = () => { $("ccfullid").innerHTML = (state.team || "<em>队伍</em>") + "_" + (state.pid || "<em>ID</em>"); foot(); };
          $("ccteam").oninput = (e) => { state.team = e.target.value.trim(); upd(); };
          $("ccpid").oninput = (e) => { state.pid = e.target.value.trim(); upd(); };
          upd();
        } else if (state.step === 1) {
          c.innerHTML = `<div class="opts two">
            <div class="opt" data-role="survivor"><div class="oh"><div class="nm">求生者</div></div><div class="check">✓</div></div>
            <div class="opt" data-role="hunter"><div class="oh"><div class="nm">监管者</div></div><div class="check">✓</div></div></div>`;
          c.querySelectorAll(".opt").forEach((o) => {
            o.classList.toggle("sel", state.role === o.dataset.role);
            o.onclick = () => {
              if (state.role !== o.dataset.role) { state.role = o.dataset.role; state.identity = null; state.player = null; }
              render();
            };
          });
        } else if (state.step === 2) {
          c.innerHTML = `<div class="opts" id="ccids"></div>`;
          const box = c.querySelector("#ccids");
          (IDENTITIES[state.role] || []).forEach((o) => {
            const el = document.createElement("div");
            el.className = "opt" + (state.identity === o.key ? " sel" : "");
            el.innerHTML = `<div class="oh"><div class="nm">${o.name}</div></div><div class="ds">${o.desc}</div><div class="check">✓</div>`;
            el.onclick = () => { state.identity = o.key; roll(); render(); };
            box.appendChild(el);
          });
        } else {
          c.innerHTML = `<div class="attrtop"><div style="font-family:'Sora';font-weight:600">初始天赋</div><button class="btn btn-ghost" id="ccreroll">⟳ 刷新天赋</button></div>
            <div class="attrs" id="ccattrs"></div>`;
          const wrap = $("ccattrs");
          const P = state.player;
          ATTR_ROWS.forEach((d) => {
            const raw = P[d.k];
            const el = document.createElement("div");
            el.className = "attr";
            el.innerHTML = `<div class="top"><span class="nm">${d.name}<span>${d.note}</span></span><span class="vv">${Math.round(raw)}${d.suffix}</span></div><div class="bar"><div class="bf"></div></div>`;
            wrap.appendChild(el);
            const w = Math.max(0, Math.min(100, raw));
            requestAnimationFrame(() => { el.querySelector(".bf").style.width = w + "%"; });
          });
          $("ccreroll").onclick = () => { roll(); render(); };
        }
        foot();
      }

      function foot() {
        $("ccback").style.visibility = state.step === 0 ? "hidden" : "visible";
        const last = state.step === 3, ok = valid(state.step);
        const b = $("ccnext");
        b.disabled = !ok;
        b.textContent = last ? "完成签约 ✓" : "下一步 →";
        const tips = ["填写队伍名与选手 ID", "选择一个定位", "选择一个出道身份", "满意当前天赋即可签约"];
        $("cctip").textContent = ok ? (last ? "手续齐备，可以签约了" : "已完成，继续下一步") : tips[state.step];
      }

      $("ccnext").onclick = () => {
        if (!valid(state.step)) { return; }
        if (state.step < 3) { state.step++; render(); return; }
        const P = state.player;
        const idName = IDENTITIES[state.role].find((x) => x.key === state.identity).name;
        const roleName = ROLE_CN[state.role];
        $("ccbn").textContent = P.name;
        $("ccsum").innerHTML =
          `定位：<b>${roleName}</b>　|　身份：<b>${idName}</b><br>` +
          `容貌 <b>${Math.round(P.appearance)}</b>（固定）· 体能 <b>${Math.round(P.phys)}</b> · 技术 <b>${Math.round(P.tech)}</b> · 战术 <b>${Math.round(P.tac)}</b><br>` +
          `稳定性 <b>${Math.round(P.stab)}</b> · 人气 <b>${Math.round(P.pop)}</b> · 资金 <b>${Math.round(P.money)}</b>`;
        $("ccmodal").classList.add("show");
      };

      $("ccback").onclick = () => { if (state.step > 0) { state.step--; render(); } };

      $("ccclose").onclick = () => {
        const idName = IDENTITIES[state.role].find((x) => x.key === state.identity).name;
        const result = { player: state.player, role: ROLE_CN[state.role], identityName: idName };
        cc.classList.remove("show");
        $("ccmodal").classList.remove("show");
        cc.innerHTML = "";
        resolve(result);
      };

      render();
    });
  }

  window.IVLChargen = { run };
})();
