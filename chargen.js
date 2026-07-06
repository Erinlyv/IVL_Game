/* =============================================================================
 * IVL 模拟器 · 角色创建流程（demo6 原样移植 + demov4.2feedbackrole 扩展）
 * 交互/视觉照搬 demo6「俱乐部签约」，六步：建档 → 定位 → 位置 → 常用角色 → 身份 → 天赋。
 *   · 位置：不同位置决定常用角色池范围（求生者 4 位 / 监管者 3 位）。
 *   · 常用角色：以「词条」呈现角色池，必选 3 个，其中至少 2 个为该位置推荐角色。
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

  // 位置选择（demov4.2feedbackrole《角色创建·位置选择选项》）：不同位置决定常用角色池范围。
  //   求生者：牵制 / 救人 / OB / 辅助；监管者：追击 / 控场 / 守椅。
  const POSITIONS = {
    survivor: [
      { key: "qz", name: "牵制位", desc: "牵制型功能位" },
      { key: "jr", name: "救人位", desc: "救援型功能位" },
      { key: "ob", name: "OB 位", desc: "干扰型支援位" },
      { key: "fz", name: "辅助位", desc: "辅助型支援位" },
    ],
    hunter: [
      { key: "zj", name: "追击型", desc: "通过快速击倒求生者把握对局节奏" },
      { key: "kc", name: "控场型", desc: "通过消耗求生者把对局拖入自己的节奏" },
      { key: "sy", name: "守椅型", desc: "通过守椅博弈扩大对局优势" },
    ],
  };

  // 常用角色池（demov4.2feedbackrole《角色创建·常用角色选择》）：按位置区分「推荐 / 可选」。
  //   规则：每人必选 3 个常用角色，其中至少 2 个为该位置推荐角色（也可三个都选推荐）。
  const ROLE_POOL = {
    qz: {
      rec: ["气象学家", "机械师", "幸运儿", "幻灯师", "先知", "病患", "飞行家", "小说家", "木偶师"],
      opt: ["拉拉队员", "火灾调查员", "心理学家", "杂技演员", "囚徒", "医生", "律师", "慈善家", "园丁", "魔术师", "空军", "盲女", "祭司", "舞女", "调香师", "入殓师", "咒术师", "调酒师", "邮差", "昆虫学者", "画家", "玩具商", "小女孩", "教授", "作曲家", "记者", "法罗女士", "骑士", "弓箭手", "斗牛士"],
    },
    jr: {
      rec: ["佣兵", "大副", "野人", "守墓人", "哭泣小丑", "逃脱大师"],
      opt: ["病患", "小说家", "记者", "骑士", "空军", "前锋", "入殓师", "心理学家", "木偶师", "杂技演员", "律师", "园丁", "魔术师", "冒险家"],
    },
    ob: {
      rec: ["击球手", "勘探员", "前锋", "牛仔", "弓箭手", "古董商", "哭泣小丑"],
      opt: ["气象学家", "拉拉队员", "火灾调查员", "心理学家", "幸运儿", "木偶师", "杂技演员", "幻灯师", "慈善家", "园丁", "魔术师", "空军", "先知", "入殓师", "咒术师", "调酒师", "邮差", "画家", "斗牛士", "小说家", "小女孩", "教授", "记者", "病患", "飞行家", "骑士"],
    },
    fz: {
      rec: ["气象学家", "火灾调查员", "幸运儿", "幻灯师", "医生", "祭司", "昆虫学者", "画家", "调酒师", "玩具商"],
      opt: ["小说家", "小女孩", "教授", "哭泣小丑", "古董商", "记者", "骑士", "弓箭手", "空军", "调香师", "先知", "入殓师", "咒术师", "邮差", "拉拉队员", "心理学家", "木偶师", "园丁", "冒险家"],
    },
    zj: {
      rec: ["歌剧演员", "喧嚣", "女王蜂", "跛脚羊", "台球手"],
      opt: ["小丑", "红蝶", "宿伞之魂", "红夫人", "使徒", "渔女", "守夜人", "时空之影", "爱哭鬼", "孽蜥", "26号守卫", "博士", "破轮", "小提琴家", "蜡像师", "愚人金", "杰克", "鹿头", "杂货商", "厂长", "蜘蛛"],
    },
    kc: {
      rec: ["时空之影", "梦之女巫", "跛脚羊", "台球手", "女王蜂"],
      opt: ["疯眼", "破轮", "蜡像师", "噩梦", "隐士", "记录员", "杂货商", "厂长", "歌剧演员", "宿伞之魂", "摄影师", "使徒", "守夜人", "鹿头", "蜘蛛", "喧嚣"],
    },
    sy: {
      rec: ["26号守卫", "跛脚羊", "喧嚣", "台球手", "女王蜂"],
      opt: ["厂长", "小丑", "宿伞之魂", "使徒", "守夜人", "渔女", "时空之影", "歌剧演员", "鹿头", "蜘蛛", "黄衣之主", "爱哭鬼", "孽蜥", "小提琴家", "雕刻家", "杂货商", "愚人金", "蜡像师"],
    },
  };
  const posName = (role, key) => ((POSITIONS[role] || []).find((p) => p.key === key) || {}).name || "";
  const REC_MIN = 2;      // 至少选 2 个推荐角色
  const ROLE_MAX = 3;     // 必选 3 个常用角色

  // 天赋面板：四维核心（数值总量内随机分配）+ 容貌 / 人气 单独一行（v4.0《demov3.0feedback》）。
  // 删除天赋选择界面的「资金」展示。
  const CORE_ROWS = [
    { k: "tech", name: "技术", note: "得分核心", suffix: "" },
    { k: "tac", name: "战术", note: "运营核心", suffix: "" },
    { k: "phys", name: "体能", note: "体力上限", suffix: "" },
    { k: "stab", name: "稳定性", note: "关键场心态", suffix: "" },
  ];
  const EXTRA_ROWS = [
    { k: "appearance", name: "容貌", note: "全程固定", suffix: "" },
    { k: "pop", name: "人气", note: "粉丝/应援", suffix: " 万" },
  ];

  // 随机名称池（v4.0）：全部为虚构名，刻意规避现实电竞战队 / 选手名称。
  const ROLL_TEAMS = ["NOVA", "APEX", "ONYX", "COMET", "VEGA", "HERO", "BOLT", "FROST", "EMBER", "QUARTZ",
    "LUMEN", "CREST", "DRIFT", "PULSE", "VAPOR", "HALO", "ZENITH", "ASTER", "HELIX", "PYRA", "VESPER"];
  const ROLL_IDS = ["Ace", "Kira", "Nyx", "Volt", "Echo", "Sora", "Lumi", "Riku", "Yuki",
    "Zed", "Milo", "Coco", "Pino", "Nana", "Toby", "Kai", "Ren", "Aki", "Leo", "Mira", "Juno"];
  const randPick = (a) => a[Math.floor(Math.random() * a.length)];

  const STEPS = [
    { title: "建立选手档案" },
    { title: "选择你的阵营" },
    { title: "选择你的位置" },   // 监管者时在 render() 覆盖为「选择你擅长的监管者类型」
    { title: "选择常用角色" },
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
          <div class="p" data-i="1"><span class="n">2</span>阵营</div><div class="sep"></div>
          <div class="p" data-i="2"><span class="n">3</span>位置</div><div class="sep"></div>
          <div class="p" data-i="3"><span class="n">4</span>角色</div><div class="sep"></div>
          <div class="p" data-i="4"><span class="n">5</span>身份</div><div class="sep"></div>
          <div class="p" data-i="5"><span class="n">6</span>天赋</div>
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
        <div class="bn" id="ccbn">Nova_Rookie</div>
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

      const state = { step: 0, team: "", pid: "", role: null, position: null, roles: [], identity: null, player: null };
      // 常用角色是否满足规则：恰好 3 个，且其中至少 REC_MIN 个为当前位置推荐角色。
      const recCount = () => {
        if (!state.position) { return 0; }
        const rec = ROLE_POOL[state.position].rec;
        return state.roles.filter((r) => rec.includes(r)).length;
      };
      const rolesValid = () => state.roles.length === ROLE_MAX && recCount() >= REC_MIN;
      const valid = (i) =>
        i === 0 ? !!(state.team && state.pid) :
        i === 1 ? !!state.role :
        i === 2 ? !!state.position :
        i === 3 ? rolesValid() :
        i === 4 ? !!state.identity :
        !!state.player;

      function roll() {
        state.player = new E.Player(
          ID_ENGINE[state.identity],
          state.team || "Nova",
          state.pid || "无名选手",
          ROLE_CN[state.role]
        );
      }

      // 常用角色词条选择（demov4.2feedbackrole）：以「词条」呈现角色池，选中即高亮。
      function renderRoles(c) {
        const pool = ROLE_POOL[state.position];
        if (!pool) { c.innerHTML = ""; return; }
        $("ccguide").innerHTML = `每人必选 <b>${ROLE_MAX}</b> 个常用角色，其中至少 <b>${REC_MIN}</b> 个为该位置的推荐角色。`;
        $("ccguide").style.display = "block";
        c.innerHTML = `
          <div class="rolepick">
            <div class="rp-counter" id="ccrpc"></div>
            <div class="rp-group">
              <div class="rp-glabel"><span class="rp-dot rec"></span>推荐角色<em>（至少选 ${REC_MIN} 个）</em></div>
              <div class="chips" id="ccrec"></div>
            </div>
            <div class="rp-group">
              <div class="rp-glabel"><span class="rp-dot"></span>可选角色</div>
              <div class="chips" id="ccopt"></div>
            </div>
          </div>`;
        const build = (wrap, names, isRec) => {
          names.forEach((nm) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "chip" + (isRec ? " rec" : "");
            b.dataset.name = nm;
            b.textContent = nm;
            b.onclick = () => toggleRole(nm);
            wrap.appendChild(b);
          });
        };
        build($("ccrec"), pool.rec, true);
        build($("ccopt"), pool.opt, false);
        syncRoles();
      }
      function toggleRole(nm) {
        const i = state.roles.indexOf(nm);
        if (i >= 0) { state.roles.splice(i, 1); }
        else { if (state.roles.length >= ROLE_MAX) { return; } state.roles.push(nm); }
        syncRoles();
      }
      // 就地刷新词条选中态 / 计数 / 底栏（不整段重渲染，避免长列表滚动位置丢失）。
      function syncRoles() {
        const full = state.roles.length >= ROLE_MAX;
        cc.querySelectorAll("#cccontent .chip").forEach((b) => {
          const on = state.roles.includes(b.dataset.name);
          b.classList.toggle("sel", on);
          b.classList.toggle("dim", full && !on);
        });
        const rc = recCount(), okRec = rc >= REC_MIN, okNum = state.roles.length === ROLE_MAX;
        const el = $("ccrpc");
        if (el) {
          el.innerHTML = `已选 <b class="${okNum ? "good" : ""}">${state.roles.length}</b>/${ROLE_MAX}　·　推荐 <b class="${okRec ? "good" : ""}">${rc}</b>/${REC_MIN}`;
        }
        foot();
      }

      function render() {
        cc.querySelectorAll("#cctrack .p").forEach((p) => {
          const i = +p.dataset.i;
          p.classList.toggle("on", i === state.step);
          p.classList.toggle("ok", i < state.step && valid(i));
        });
        // demov4.3feedback《文案·初始位置选择》：监管者的位置步标题改为「选择你擅长的监管者类型」。
        $("cctitle").textContent = (state.step === 2 && state.role === "hunter")
          ? "选择你擅长的监管者类型"
          : STEPS[state.step].title;
        $("ccguide").style.display = "none";
        const c = $("cccontent");
        c.innerHTML = "";

        if (state.step === 0) {
          c.innerHTML = `<div class="fieldrow">
            <div class="field"><label class="lab">队伍名称（≤8字）</label>
              <div class="inprow"><input class="inp" id="ccteam" maxlength="8" placeholder="例：Nova" value="${state.team}"><button class="btn btn-roll" type="button" id="ccteamroll" title="随机队名">🎲</button></div></div>
            <div class="field"><label class="lab">选手 ID（≤12字）</label>
              <div class="inprow"><input class="inp" id="ccpid" maxlength="12" placeholder="例：Ace" value="${state.pid}"><button class="btn btn-roll" type="button" id="ccpidroll" title="随机 ID">🎲</button></div></div></div>
            <div class="signrow"><div class="badge">ID</div><div><div class="k">登记在册的完整选手 ID</div><div class="v" id="ccfullid"></div></div></div>`;
          const upd = () => { $("ccfullid").innerHTML = (state.team || "<em>队伍</em>") + "_" + (state.pid || "<em>ID</em>"); foot(); };
          $("ccteam").oninput = (e) => { state.team = e.target.value.trim(); upd(); };
          $("ccpid").oninput = (e) => { state.pid = e.target.value.trim(); upd(); };
          $("ccteamroll").onclick = () => { state.team = randPick(ROLL_TEAMS); $("ccteam").value = state.team; upd(); };
          $("ccpidroll").onclick = () => { state.pid = randPick(ROLL_IDS); $("ccpid").value = state.pid; upd(); };
          upd();
        } else if (state.step === 1) {
          c.innerHTML = `<div class="opts two">
            <div class="opt" data-role="survivor"><div class="oh"><div class="nm">求生者</div></div><div class="check">✓</div></div>
            <div class="opt" data-role="hunter"><div class="oh"><div class="nm">监管者</div></div><div class="check">✓</div></div></div>`;
          c.querySelectorAll(".opt").forEach((o) => {
            o.classList.toggle("sel", state.role === o.dataset.role);
            o.onclick = () => {
              if (state.role !== o.dataset.role) {
                // 定位变更连带重置：位置 / 常用角色 / 身份 / 天赋均失效重来。
                state.role = o.dataset.role; state.position = null; state.roles = []; state.identity = null; state.player = null;
              }
              render();
            };
          });
        } else if (state.step === 2) {
          $("ccguide").textContent = "不同位置对应不同的常用角色池";
          $("ccguide").style.display = "block";
          c.innerHTML = `<div class="opts" id="ccpos"></div>`;
          const box = c.querySelector("#ccpos");
          (POSITIONS[state.role] || []).forEach((o) => {
            const el = document.createElement("div");
            el.className = "opt" + (state.position === o.key ? " sel" : "");
            el.innerHTML = `<div class="oh"><div class="nm">${o.name}</div></div><div class="ds">${o.desc}</div><div class="check">✓</div>`;
            el.onclick = () => {
              if (state.position !== o.key) { state.position = o.key; state.roles = []; }
              render();
            };
            box.appendChild(el);
          });
        } else if (state.step === 3) {
          renderRoles(c);
        } else if (state.step === 4) {
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
          const P = state.player;
          const tot = Math.round(P.tech + P.tac + P.phys + P.stab);
          c.innerHTML = `<div class="attrtop"><div style="font-family:'Sora';font-weight:600">初始天赋 <span class="attrtotal">四维总量 ${tot}</span></div><button class="btn btn-ghost" id="ccreroll">⟳ 刷新天赋</button></div>
            <div class="attrs" id="ccattrs"></div>
            <div class="attrextra" id="ccattrx"></div>`;
          const mkAttr = (wrap, d) => {
            const raw = P[d.k];
            const el = document.createElement("div");
            el.className = "attr";
            el.innerHTML = `<div class="top"><span class="nm">${d.name}<span>${d.note}</span></span><span class="vv">${Math.round(raw)}${d.suffix}</span></div><div class="bar"><div class="bf"></div></div>`;
            wrap.appendChild(el);
            const w = Math.max(0, Math.min(100, raw));
            requestAnimationFrame(() => { el.querySelector(".bf").style.width = w + "%"; });
          };
          CORE_ROWS.forEach((d) => mkAttr($("ccattrs"), d));
          EXTRA_ROWS.forEach((d) => mkAttr($("ccattrx"), d));
          $("ccreroll").onclick = () => { roll(); render(); };
        }
        foot();
      }

      function foot() {
        $("ccback").style.visibility = state.step === 0 ? "hidden" : "visible";
        const last = state.step === STEPS.length - 1, ok = valid(state.step);
        const b = $("ccnext");
        b.disabled = !ok;
        b.textContent = last ? "完成签约 ✓" : "下一步 →";
        const tips = ["填写队伍名与选手 ID", "选择一个阵营", "选择一个位置", `选择 ${ROLE_MAX} 个常用角色（含 ≥${REC_MIN} 个推荐）`, "选择一个出道身份", "满意当前天赋即可签约"];
        $("cctip").textContent = ok ? (last ? "手续齐备，可以签约了" : "已完成，继续下一步") : tips[state.step];
      }

      // 把位置 / 常用角色写入 player，供主流程（左侧栏、季后赛/深渊属性栏）读取。
      function attachRoleMeta() {
        if (!state.player) { return; }
        state.player.position = state.position;
        state.player.positionName = posName(state.role, state.position);
        state.player.commonRoles = state.roles.slice();
      }

      $("ccnext").onclick = () => {
        if (!valid(state.step)) { return; }
        if (state.step < STEPS.length - 1) { state.step++; render(); return; }
        attachRoleMeta();
        const P = state.player;
        const idName = IDENTITIES[state.role].find((x) => x.key === state.identity).name;
        const roleName = ROLE_CN[state.role];
        $("ccbn").textContent = P.name;
        $("ccsum").innerHTML =
          `阵营：<b>${roleName}</b>　|　位置：<b>${P.positionName}</b>　|　身份：<b>${idName}</b><br>` +
          `常用角色：<b>${state.roles.join(" / ")}</b><br>` +
          `容貌 <b>${Math.round(P.appearance)}</b>（固定）· 体能 <b>${Math.round(P.phys)}</b> · 技术 <b>${Math.round(P.tech)}</b> · 战术 <b>${Math.round(P.tac)}</b><br>` +
          `稳定性 <b>${Math.round(P.stab)}</b> · 人气 <b>${Math.round(P.pop)}</b> · 资金 <b>${Math.round(P.money)}</b>`;
        $("ccmodal").classList.add("show");
      };

      $("ccback").onclick = () => { if (state.step > 0) { state.step--; render(); } };

      $("ccclose").onclick = () => {
        attachRoleMeta();
        const idName = IDENTITIES[state.role].find((x) => x.key === state.identity).name;
        const result = {
          player: state.player, role: ROLE_CN[state.role], identityName: idName,
          position: posName(state.role, state.position), commonRoles: state.roles.slice(),
        };
        cc.classList.remove("show");
        $("ccmodal").classList.remove("show");
        cc.innerHTML = "";
        resolve(result);
      };

      render();
    });
  }

  // demov5.0feedback·转位置修复：把「定位 / 常用角色池」数据与「随机改派定位」能力暴露给主流程
  // （game.js）。转阵营（求生者↔监管者）时，旧定位仍属原阵营，会让总决赛按 P.position 选到错误的
  // 剧情线，并连带 positionName / 常用角色 / 「世界第一」系列成就错位。此处提供集中入口，保证数据同源。
  //   roleCn：引擎中文阵营（"求生者" | "监管者"）。返回 { position, positionName, commonRoles } 或 null。
  function rerollPosition(roleCn) {
    const roleKey = (roleCn === "监管者") ? "hunter" : "survivor";
    const positions = POSITIONS[roleKey] || [];
    if (!positions.length) { return null; }
    const pos = randPick(positions);
    const pool = ROLE_POOL[pos.key] || { rec: [], opt: [] };
    // 复用建档时的常用角色规则：恰好 ROLE_MAX 个，其中至少 REC_MIN 个为该定位推荐角色。
    const sample = (arr, n) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a.slice(0, Math.max(0, Math.min(n, a.length)));
    };
    const recPicked = sample(pool.rec, REC_MIN);
    const rest = pool.rec.concat(pool.opt).filter((r) => recPicked.indexOf(r) < 0);
    const fill = sample(rest, Math.max(0, ROLE_MAX - recPicked.length));
    const commonRoles = recPicked.concat(fill).slice(0, ROLE_MAX);
    return { position: pos.key, positionName: pos.name, commonRoles };
  }

  window.IVLChargen = { run, POSITIONS, ROLE_POOL, rerollPosition };
})();
