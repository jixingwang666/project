(function (global) {
  var state = {
    selectedSimulationId: "",
    simulations: [],
    rows: []
  };

  var METRIC_OPTIONS = [
    { key: "simTime",                label: "仿真时间 (simTime)" },
    { key: "frameIndex",             label: "帧序号 (frameIndex)" },
    { key: "totalEvacuated",         label: "已疏散人数" },
    { key: "casualtyCount",          label: "伤亡人数" },
    { key: "inWaterDeep",            label: "深水区人数" },
    { key: "avgExposureTime",        label: "平均暴露时长" },
    { key: "zoneMaxWaterLevel",      label: "区域最高水位" },
    { key: "zoneMaxFireIntensity",   label: "区域最高火势强度" },
    { key: "zoneMaxSmokeDensity",    label: "区域最高烟雾密度" },
    { key: "zoneMaxGasConcentration",label: "区域最高毒气浓度" },
    { key: "agentCount",             label: "智能体总数" },
    { key: "agentAvgPanicLevel",     label: "平均恐慌程度" },
    { key: "activeEntityCount",      label: "活跃特殊实体数" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    var el = $("history-status");
    if (el) {
      el.textContent = text;
    }
  }

  function safeNumber(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatTime(v) {
    return safeNumber(v, 0).toFixed(2);
  }

  function maxFrom(arr, key) {
    var values = (arr || []).map(function (it) { return safeNumber(it[key], 0); });
    if (!values.length) {
      return 0;
    }
    return Math.max.apply(Math, values);
  }

  function avgFrom(arr, key) {
    var list = (arr || []).map(function (it) { return Number(it[key]); }).filter(function (n) { return Number.isFinite(n); });
    if (!list.length) {
      return 0;
    }
    var sum = list.reduce(function (acc, n) { return acc + n; }, 0);
    return sum / list.length;
  }

  function extractRow(frame) {
    var statistics = frame.statistics || {};
    var zones = frame.environment && Array.isArray(frame.environment.zones) ? frame.environment.zones : [];
    var agents = Array.isArray(frame.agents) ? frame.agents : [];
    var entities = Array.isArray(frame.specialEntities) ? frame.specialEntities : [];

    return {
      simTime: safeNumber(frame.simTime, 0),
      frameIndex: safeNumber(frame.frameIndex, 0),
      totalEvacuated: safeNumber(statistics.totalEvacuated, 0),
      casualtyCount: safeNumber(statistics.casualtyCount, 0),
      inWaterDeep: safeNumber(statistics.inWaterDeep, 0),
      avgExposureTime: safeNumber(statistics.avgExposureTime, 0),
      zoneMaxWaterLevel: maxFrom(zones, "waterLevel"),
      zoneMaxFireIntensity: maxFrom(zones, "fireIntensity"),
      zoneMaxSmokeDensity: maxFrom(zones, "smokeDensity"),
      zoneMaxGasConcentration: maxFrom(zones, "gasConcentration"),
      agentCount: agents.length,
      agentAvgPanicLevel: avgFrom(agents, "panicLevel"),
      activeEntityCount: entities.filter(function (e) { return e && e.state === "active"; }).length
    };
  }

  function renderSimulationList() {
    var container = $("sim-list");
    var count = $("sim-count");
    container.innerHTML = "";

    if (count) {
      count.textContent = state.simulations.length + " 条";
    }

    if (!state.simulations.length) {
      container.innerHTML = '<div class="empty">暂无仿真历史记录</div>';
      return;
    }

    state.simulations.forEach(function (sim) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "sim-item" + (sim.simulationId === state.selectedSimulationId ? " active" : "");
      item.innerHTML = ""
        + '<div class="sim-id">' + sim.simulationId + "</div>"
        + '<div class="sim-meta">场景: ' + (sim.scenarioId || "-") + "</div>"
        + '<div class="sim-meta">状态: ' + (sim.status || "-") + "</div>"
        + '<div class="sim-meta">创建: ' + new Date(sim.createdAt).toLocaleString() + "</div>";
      item.addEventListener("click", function () {
        loadTimeline(sim.simulationId);
      });
      container.appendChild(item);
    });
  }

  function renderTimelineRows() {
    var tbody = $("timeline-body");
    tbody.innerHTML = "";

    if (!state.rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">当前仿真暂无可展示帧数据</td></tr>';
      return;
    }

    state.rows
      .sort(function (a, b) { return a.simTime - b.simTime; })
      .forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML = ""
          + "<td>" + formatTime(row.simTime) + "</td>"
          + "<td>" + row.frameIndex + "</td>"
          + "<td>" + row.totalEvacuated + "</td>"
          + "<td>" + row.zoneMaxWaterLevel.toFixed(3) + "</td>"
          + "<td>" + row.zoneMaxFireIntensity.toFixed(3) + "</td>"
          + "<td>" + row.agentCount + "</td>"
          + "<td>" + row.activeEntityCount + "</td>";
        tbody.appendChild(tr);
      });
  }

  function renderAxisOptions() {
    var xSelect = $("line-x-axis");
    var yContainer = $("line-y-axis");

    xSelect.innerHTML = METRIC_OPTIONS.map(function (option) {
      return '<option value="' + option.key + '">' + option.label + "</option>";
    }).join("");

    yContainer.innerHTML = METRIC_OPTIONS.map(function (option, idx) {
      var checked = idx > 1 && idx < 5;
      return ""
        + '<label class="y-axis-item">'
        + '<input type="checkbox" class="line-y-item" value="' + option.key + '"' + (checked ? " checked" : "") + ">"
        + "<span>" + option.label + "</span>"
        + "</label>";
    }).join("");
  }

  function getLabelByKey(key) {
    for (var i = 0; i < METRIC_OPTIONS.length; i++) {
      if (METRIC_OPTIONS[i].key === key) return METRIC_OPTIONS[i].label;
    }
    return key;
  }

  function getDataByKey(row, key) {
    return safeNumber(row[key], 0);
  }

  // ====== 纯 Canvas 图表渲染（零外部依赖） ======

  var COLORS = ["#2563eb","#dc2626","#16a34a","#ca8a04","#9333ea","#0891b2","#e11d48","#65a30d"];

  function renderChart() {
    var type = $("analysis-type").value;
    var lineCfg = $("line-config");
    var canvasWrap = $("chart-container");
    var placeholder = $("analysis-placeholder");

    if (type !== "line" && type !== "bar") {
      lineCfg.style.display = "none";
      if (canvasWrap) canvasWrap.style.display = "none";
      placeholder.style.display = "block";
      placeholder.textContent = "「" + $("analysis-type").selectedOptions[0].text + "」已预留接口，后续可接入对应绘图引擎。";
      return;
    }

    lineCfg.style.display = "grid";
    placeholder.style.display = "none";

    var yChecks = document.querySelectorAll(".line-y-item:checked");
    var yKeys = [];
    for (var i = 0; i < yChecks.length; i++) { yKeys.push(yChecks[i].value); }

    if (!yKeys.length) {
      if (canvasWrap) canvasWrap.style.display = "none";
      placeholder.style.display = "block";
      placeholder.textContent = "请至少选择一个纵轴字段来生成图表。";
      return;
    }

    if (!state.rows || !state.rows.length) {
      if (canvasWrap) canvasWrap.style.display = "none";
      placeholder.style.display = "block";
      placeholder.textContent = "当前仿真暂无数据，请先选择一条仿真记录。";
      return;
    }

    if (!canvasWrap) { placeholder.style.display = "block"; return; }
    canvasWrap.style.display = "block";

    // 准备数据
    var sorted = state.rows.slice().sort(function (a, b) { return a.simTime - b.simTime; });
    var series = yKeys.map(function (yk) {
      return { key: yk, label: getLabelByKey(yk), values: sorted.map(function (r) { return getDataByKey(r, yk); }) };
    });

    // 创建或复用 canvas
    var canvas = $("chart-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "chart-canvas";
      canvasWrap.innerHTML = "";
      canvasWrap.appendChild(canvas);
    }

    // 设置高 DPI
    var W = canvasWrap.clientWidth || 700;
    var H = 380;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 边距
    var pad = { top: 20, right: 30, bottom: 80, left: 70 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    // 计算 Y 范围
    var allVals = [];
    series.forEach(function (s) { allVals = allVals.concat(s.values); });
    var yMin = 0;
    var yMax = Math.max.apply(Math, allVals.concat([1]));
    yMax = yMax * 1.15;

    function xPos(i) { return pad.left + (i / Math.max(sorted.length - 1, 1)) * pw; }
    function yPos(v) { return pad.top + ph - ((v - yMin) / (yMax - yMin)) * ph; }

    // 清空
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    // 网格线 + Y 轴标签
    var gridLines = 5;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    for (var g = 0; g <= gridLines; g++) {
      var val = yMin + (yMax - yMin) * (g / gridLines);
      var gy = yPos(val);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
      ctx.fillText(val >= 1 ? Math.round(val).toString() : val.toFixed(2), pad.left - 6, gy + 4);
    }

    // X 轴标签
    ctx.textAlign = "center";
    ctx.fillStyle = "#374151";
    var labelStep = Math.max(1, Math.floor(sorted.length / 10));
    for (var xi = 0; xi < sorted.length; xi += labelStep) {
      var lx = xPos(xi);
      ctx.fillText(sorted[xi].simTime.toFixed(0) + "s", lx, pad.top + ph + 16);
    }
    // X 轴标题
    ctx.fillText(getLabelByKey($("line-x-axis").value), pad.left + pw / 2, pad.top + ph + 36);

    // Y 轴标题
    ctx.save();
    ctx.translate(14, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("数值", 0, 0);
    ctx.restore();

    // 裁剪区域
    ctx.save();
    ctx.beginPath(); ctx.rect(pad.left, pad.top, pw, ph); ctx.clip();

    // 绘制数据
    series.forEach(function (s, si) {
      var color = COLORS[si % COLORS.length];

      if (type === "bar") {
        var barW = (pw / sorted.length) * 0.7 / series.length;
        var offset = (si - (series.length - 1) / 2) * (barW * 1.1);
        sorted.forEach(function (r, ri) {
          var v = getDataByKey(r, s.key);
          var bx = xPos(ri) + offset;
          var by = yPos(v);
          var bh = yPos(0) - by;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(bx - barW / 2, by, barW, bh);
          ctx.globalAlpha = 1;
        });
      } else {
        // 折线图
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        sorted.forEach(function (r, ri) {
          var v = getDataByKey(r, s.key);
          var sx = xPos(ri), sy = yPos(v);
          if (ri === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        });
        ctx.stroke();

        // 数据点
        sorted.forEach(function (r, ri) {
          var v = getDataByKey(r, s.key);
          var sx = xPos(ri), sy = yPos(v);
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
        });
      }
    });

    ctx.restore();

    // 图例
    var legendY = H - 18;
    var legendX = pad.left;
    series.forEach(function (s, si) {
      var color = COLORS[si % COLORS.length];
      var text = s.label;
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 6, 14, 12);
      ctx.fillStyle = "#374151";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(text, legendX + 18, legendY + 4);
      legendX += ctx.measureText(text).width + 34;
    });
  }

  function updateAnalysisPlaceholder() {
    renderChart();
  }

  function createSampleTimes(minSimTime, maxSimTime, sampleCount) {
    var min = safeNumber(minSimTime, 0);
    var max = safeNumber(maxSimTime, min);

    if (max <= min) {
      return [min];
    }

    var step = (max - min) / (sampleCount - 1);
    var times = [];
    for (var i = 0; i < sampleCount; i += 1) {
      times.push(min + step * i);
    }
    return times;
  }

  function loadTimeline(simulationId) {
    if (!simulationId) {
      return;
    }

    state.selectedSimulationId = simulationId;
    renderSimulationList();
    setStatus("正在加载数据...");

    $("timeline-title").textContent = "时间顺序数据列 - " + simulationId;
    $("timeline-desc").textContent = "正在读取帧数据...";

    // 改用批量接口，一次请求拿回所有帧，比原来 24 次快得多
    global.MiddlewareClient.getAllFrames(simulationId)
      .then(function (res) {
        var frames = (res && res.payload && res.payload.frames) || [];
        state.rows = frames.map(extractRow);
        renderTimelineRows();
        updateAnalysisPlaceholder();
        $("timeline-desc").textContent = "共 " + state.rows.length + " 帧";
        setStatus("已加载 " + state.rows.length + " 条帧");
      })
      .catch(function (err) {
        state.rows = [];
        renderTimelineRows();
        $("timeline-desc").textContent = "加载失败";
        setStatus("加载失败: " + (err && err.message ? err.message : "unknown"));
      });
  }

  function loadSimulations() {
    setStatus("正在加载仿真历史列表...");
    global.MiddlewareClient.listSimulations()
      .then(function (res) {
        var payload = res && res.payload ? res.payload : {};
        state.simulations = Array.isArray(payload.simulations) ? payload.simulations : [];
        renderSimulationList();

        if (!state.simulations.length) {
          setStatus("当前没有可用的仿真历史记录");
          return;
        }

        setStatus("仿真历史加载完成");
        loadTimeline(state.simulations[0].simulationId);
      })
      .catch(function (err) {
        state.simulations = [];
        renderSimulationList();
        setStatus("列表加载失败: " + (err && err.message ? err.message : "unknown"));
      });
  }

  function bindEvents() {
    $("btn-open-analysis").addEventListener("click", function () {
      $("analysis-panel").classList.toggle("hidden");
    });

    $("btn-close-analysis").addEventListener("click", function () {
      $("analysis-panel").classList.add("hidden");
    });

    $("btn-refresh-sims").addEventListener("click", function () {
      loadSimulations();
    });

    $("analysis-type").addEventListener("change", updateAnalysisPlaceholder);
    $("line-x-axis").addEventListener("change", updateAnalysisPlaceholder);
    $("line-y-axis").addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("line-y-item")) {
        updateAnalysisPlaceholder();
      }
    });
  }

  function init() {
    renderAxisOptions();
    bindEvents();
    updateAnalysisPlaceholder();
    loadSimulations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
