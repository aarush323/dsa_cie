let graphData = null;
let sourceNode = null;
let endNode = null;
let trafficCondition = "none";
let weatherCondition = "clear";
let activeEdgeConditions = "all";

const SVG_NS = "http://www.w3.org/2000/svg";

async function loadGraph() {
    console.log("Loading graph...");
    try {
        const res = await fetch("/api/graph");
        graphData = await res.json();
        console.log("Graph data received:", graphData);

        if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
            console.error("No nodes in graph data!");
            return;
        }

        autoScaleSVG();
        populateDropdowns();
        drawGraph();
    } catch (e) {
        console.error("Error loading graph:", e);
    }
}

function autoScaleSVG() {
    const svg = document.getElementById("graph-svg");
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    graphData.nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
    });

    const padding = 140;
    const viewboxStr = `${minX - padding} ${minY - padding} ${(maxX - minX) + padding * 2} ${(maxY - minY) + padding * 2}`;
    console.log("Setting SVG viewBox:", viewboxStr);
    svg.setAttribute("viewBox", viewboxStr);
}

function populateDropdowns() {
    const src = document.getElementById("source-select");
    const dst = document.getElementById("dest-select");
    const edges = document.getElementById("edge-select");

    src.innerHTML = `<option value="" disabled selected>Starting Point...</option>`;
    dst.innerHTML = `<option value="" disabled selected>Destination...</option>`;
    edges.innerHTML = `<option value="all">All Routes (Global)</option>`;

    graphData.nodes.forEach((n) => {
        src.innerHTML += `<option value="${n.name}">${n.name}</option>`;
        dst.innerHTML += `<option value="${n.name}">${n.name}</option>`;
    });

    graphData.edges.forEach(e => {
        edges.innerHTML += `<option value="${edgeKey(e.from, e.to)}">${e.from} ↔ ${e.to}</option>`;
    });

    src.addEventListener('change', (e) => {
        if (sourceNode) clearNodeStyling(sourceNode);
        sourceNode = e.target.value;
        highlightNode(sourceNode, "start");
        checkPromptState();
    });

    dst.addEventListener('change', (e) => {
        if (endNode) clearNodeStyling(endNode);
        endNode = e.target.value;
        highlightNode(endNode, "end");
        checkPromptState();
    });
}

function drawGraph() {
    const svg = document.getElementById("graph-svg");
    svg.innerHTML = "";

    const defs = createSVG("defs");
    const filter = createSVG("filter", { id: "path-glow" });
    filter.innerHTML = `<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
    defs.appendChild(filter);

    const pinShadow = createSVG("filter", { id: "pin-shadow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    pinShadow.innerHTML = `<feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.3"/>`;
    defs.appendChild(pinShadow);
    svg.appendChild(defs);

    const edgeGroup = createSVG("g", { id: "edges" });
    graphData.edges.forEach(e => {
        const from = graphData.nodes.find(n => n.name === e.from);
        const to = graphData.nodes.find(n => n.name === e.to);
        const line = createSVG("line", {
            x1: from.x, y1: from.y,
            x2: to.x, y2: to.y,
            class: "graph-edge",
            id: `edge-${edgeKey(e.from, e.to)}`
        });
        edgeGroup.appendChild(line);
    });

    graphData.edges.forEach(e => {
        const from = graphData.nodes.find(n => n.name === e.from);
        const to = graphData.nodes.find(n => n.name === e.to);
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const bg = createSVG("rect", {
            x: mx - 22, y: my - 12,
            width: 44, height: 20,
            rx: 6, fill: "var(--edge-bg)",
            stroke: "var(--glass-border)",
            "stroke-width": 1
        });
        edgeGroup.appendChild(bg);
        const text = createSVG("text", {
            x: mx, y: my + 5,
            class: "edge-weight",
            id: `weight-${edgeKey(e.from, e.to)}`
        });
        text.textContent = e.weight + "km";
        edgeGroup.appendChild(text);
    });

    svg.appendChild(edgeGroup);
    svg.appendChild(createSVG("g", { id: "dynamic-paths" }));

    const nodeGroup = createSVG("g", { id: "nodes" });
    graphData.nodes.forEach(n => {
        const g = createSVG("g", {
            class: "graph-node",
            id: `node-${n.name.replace(/\s/g, "")}`,
            style: "cursor: pointer"
        });
        g.addEventListener('click', () => onNodeClick(n.name));
        const pin = createSVG("path", {
            d: `M ${n.x} ${n.y} m 0 -22 c -7.7 0 -14 6.3 -14 14 c 0 10.5 14 26 14 26 s 14 -15.5 14 -26 c 0 -7.7 -6.3 -14 -14 -14 z`,
            class: "node-circle",
            fill: "#60a5fa",
            stroke: "#ffffff",
            "stroke-width": 3,
            filter: "url(#pin-shadow)"
        });
        g.appendChild(pin);
        const label = createSVG("text", {
            x: n.x, y: n.y + 35,
            class: "node-label"
        });
        label.textContent = n.name;
        g.appendChild(label);
        nodeGroup.appendChild(g);
    });
    svg.appendChild(nodeGroup);
}

function onNodeClick(name) {
    if (!sourceNode) {
        sourceNode = name;
        document.getElementById("source-select").value = name;
        highlightNode(name, "start");
    } else if (!endNode) {
        endNode = name;
        document.getElementById("dest-select").value = name;
        highlightNode(name, "end");
    } else {
        clearSelection();
        sourceNode = name;
        document.getElementById("source-select").value = name;
        highlightNode(name, "start");
    }
    checkPromptState();
}

function checkPromptState() {
    const prompt = document.getElementById("selection-prompt");
    if (!sourceNode) {
        prompt.textContent = "Click on the map to set your starting location";
        prompt.classList.remove("hidden");
    } else if (!endNode) {
        prompt.textContent = "Now click your destination on the map";
        prompt.classList.remove("hidden");
    } else {
        prompt.innerHTML = `Ready! <span style="color:var(--accent)">${sourceNode} ➔ ${endNode}</span>`;
        prompt.classList.remove("hidden");
    }
}

function clearNodeStyling(name) {
    const id = `node-${name.replace(/\s/g, "")}`;
    const g = document.getElementById(id);
    if (g) {
        g.classList.remove("node-start", "node-end");
        const pin = g.querySelector(".node-circle");
        pin.setAttribute("fill", "#60a5fa");
        pin.setAttribute("stroke", "#ffffff");
    }
}

function clearSelection() {
    if (sourceNode) clearNodeStyling(sourceNode);
    if (endNode) clearNodeStyling(endNode);
    sourceNode = null;
    endNode = null;
    document.getElementById("source-select").value = "";
    document.getElementById("dest-select").value = "";
    clearPath();
}

function highlightNode(name, type) {
    const id = `node-${name.replace(/\s/g, "")}`;
    const g = document.getElementById(id);
    if (!g) return;
    g.classList.add(type === "start" ? "node-start" : "node-end");
    const pin = g.querySelector(".node-circle");
    const highlightColor = type === "start" ? "var(--success)" : "var(--danger)";
    pin.setAttribute("fill", highlightColor);
}

function clearPath() {
    document.getElementById("dynamic-paths").innerHTML = "";
    document.querySelectorAll(".graph-edge").forEach(el => el.classList.remove("highlighted"));
    document.querySelectorAll(".edge-weight").forEach(el => el.classList.remove("highlighted", "modified"));
}

// Conditions
document.getElementById("conditions-toggle").addEventListener("click", () => {
    document.querySelector(".conditions-section").classList.toggle("open");
});

document.getElementById("apply-conditions-btn").addEventListener("click", () => {
    trafficCondition = document.getElementById("traffic-select").value;
    weatherCondition = document.getElementById("weather-select").value;
    activeEdgeConditions = document.getElementById("edge-select").value;
    applyVisualConditions();
    document.querySelector(".conditions-section").classList.remove("open");
});

document.getElementById("reset-conditions-btn").addEventListener("click", () => {
    trafficCondition = "none";
    weatherCondition = "clear";
    activeEdgeConditions = "all";
    document.getElementById("traffic-select").value = "none";
    document.getElementById("weather-select").value = "clear";
    document.getElementById("edge-select").value = "all";
    document.querySelectorAll(".edge-weight").forEach(el => el.classList.remove("modified"));
    document.querySelectorAll(".edge-condition-glow").forEach(el => el.remove());
    document.querySelector(".conditions-section").classList.remove("open");
    clearPath();
});

function applyVisualConditions() {
    document.querySelectorAll(".edge-condition-glow").forEach(el => el.remove());
    const edgeGroup = document.getElementById("edges");
    graphData.edges.forEach(e => {
        const key = edgeKey(e.from, e.to);
        const weightEl = document.getElementById(`weight-${key}`);
        if (activeEdgeConditions === "all" || activeEdgeConditions === key) {
            if (trafficCondition !== "none" || weatherCondition !== "clear") {
                weightEl.classList.add("modified");
                const from = graphData.nodes.find(n => n.name === e.from);
                const to = graphData.nodes.find(n => n.name === e.to);
                const trafficColor = {
                    "none": "transparent",
                    "light": "rgba(34, 197, 94, 0.4)",
                    "moderate": "rgba(245, 158, 11, 0.5)",
                    "heavy": "rgba(239, 68, 68, 0.6)",
                    "jam": "rgba(220, 38, 38, 0.7)"
                }[trafficCondition] || "rgba(59, 130, 246, 0.3)";
                const glow = createSVG("line", {
                    x1: from.x, y1: from.y,
                    x2: to.x, y2: to.y,
                    stroke: trafficColor,
                    "stroke-width": 12,
                    class: "edge-condition-glow"
                });
                edgeGroup.insertBefore(glow, weightEl.previousSibling);
            }
        }
    });
}

// Find Route
document.getElementById("find-route-btn").addEventListener("click", async () => {
    if (!sourceNode || !endNode || sourceNode === endNode) return;
    const btn = document.getElementById("find-route-btn");
    btn.disabled = true;
    try {
        let url = `/api/find-route?source=${encodeURIComponent(sourceNode)}&destination=${encodeURIComponent(endNode)}`;
        if (trafficCondition !== "none") url += `&traffic=${trafficCondition}`;
        if (weatherCondition !== "clear") url += `&weather=${weatherCondition}`;
        if (activeEdgeConditions) url += `&edge=${activeEdgeConditions}`;
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        if (data.totalDistance >= 0) {
            drawResultPath(data);
            showResultModal(data);
        }
    } catch (e) {
        console.error(e);
    }
    btn.disabled = false;
});

function drawResultPath(data) {
    clearPath();
    data.shortestPathEdges.forEach(key => {
        const edge = document.getElementById(`edge-${key}`);
        if (edge) edge.classList.add("highlighted");
    });
    const dynamicGroup = document.getElementById("dynamic-paths");
    let pathString = "";
    data.path.forEach((nodeName, idx) => {
        const p = graphData.nodes.find(n => n.name === nodeName);
        if (idx === 0) pathString += `M ${p.x} ${p.y} `;
        else pathString += `L ${p.x} ${p.y} `;
    });
    const animatedLine = createSVG("path", { d: pathString, class: "path-line" });
    dynamicGroup.appendChild(animatedLine);
}

function showResultModal(data) {
    const modal = document.getElementById("modal-overlay");
    const wrapper = document.getElementById("result-wrapper");
    const pathHtml = data.path.map((name, i) => `<span class="path-node">${name}</span>${i < data.path.length - 1 ? `<span class="arrow">➔</span>` : ""}`).join("");
    document.getElementById("route-path").innerHTML = pathHtml;
    document.getElementById("route-distance").innerHTML = `${data.totalDistance}<span class="unit">km</span>`;

    document.getElementById("conditions-stat").style.display = (trafficCondition !== "none" || weatherCondition !== "clear") ? "block" : "none";
    const badgeWrap = document.getElementById("active-conditions-badge");
    badgeWrap.innerHTML = "";
    if (trafficCondition !== "none") badgeWrap.innerHTML += `<span class="condition-tag">Traffic: ${trafficCondition}</span>`;
    if (weatherCondition !== "clear") badgeWrap.innerHTML += `<span class="condition-tag weather-tag">Weather: ${weatherCondition}</span>`;

    const traceContainer = document.getElementById("trace-steps");
    traceContainer.innerHTML = "";
    data.trace.forEach((step, idx) => {
        const stepEl = document.createElement("div");
        stepEl.className = "trace-step";
        let relaxHtml = "";
        step.relaxations.forEach(r => {
            relaxHtml += `<div class="trace-relax ${r.updated ? 'updated' : 'skipped'}">` +
                `<span class="edge-path">${r.from} ➔ ${r.to}</span> ` +
                `<span class="edge-detail">(+${r.weight}km)</span> ` +
                `<span class="${r.updated ? 'new-dist' : 'skip-dist'}">${r.updated ? `Dist: ${r.total}` : 'No improvement'}</span></div>`;
        });
        stepEl.innerHTML = `<div class="trace-step-header"><span class="step-num">${idx + 1}</span><span class="step-action">${step.node}</span><span class="step-dist">${step.distance}km</span></div><div class="trace-relax-list">${relaxHtml}</div>`;
        traceContainer.appendChild(stepEl);
    });
    modal.classList.remove("hidden");
    wrapper.classList.remove("hidden");
}

function hideModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.getElementById("result-wrapper").classList.add("hidden");
}

document.getElementById("close-modal").addEventListener("click", hideModal);
document.getElementById("action-replan").addEventListener("click", () => { hideModal(); clearSelection(); });

function createSVG(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function edgeKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = document.querySelector('.theme-icon-sun');
const moonIcon = document.querySelector('.theme-icon-moon');
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
    if (themeName === 'light') { sunIcon.classList.remove('hidden'); moonIcon.classList.add('hidden'); }
    else { sunIcon.classList.add('hidden'); moonIcon.classList.remove('hidden'); }
}
const currentTheme = localStorage.getItem('theme') || 'dark';
setTheme(currentTheme);
themeToggleBtn.addEventListener('click', () => { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });

loadGraph();
