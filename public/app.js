let graphData = null;
let sourceNode = null;
let endNode = null;

const SVG_NS = "http://www.w3.org/2000/svg";

async function loadGraph() {
    const res = await fetch("/api/graph");
    graphData = await res.json();
    populateDropdowns();
    drawGraph();
}

function populateDropdowns() {
    const src = document.getElementById("source-select");
    const dst = document.getElementById("dest-select");
    graphData.nodes.forEach((n, i) => {
        src.innerHTML += `<option value="${n.name}">${n.name}</option>`;
        dst.innerHTML += `<option value="${n.name}" ${i === 5 ? "selected" : ""}>${n.name}</option>`;
    });
}

function drawGraph() {
    const svg = document.getElementById("graph-svg");
    svg.innerHTML = "";

    // Defs for glow filter
    const defs = createSVG("defs");
    const filter = createSVG("filter", { id: "glow" });
    const blur = createSVG("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" });
    filter.appendChild(blur);
    const merge = createSVG("feMerge");
    merge.appendChild(createSVG("feMergeNode", { in: "coloredBlur" }));
    merge.appendChild(createSVG("feMergeNode", { in: "SourceGraphic" }));
    filter.appendChild(merge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Draw edges
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

        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const text = createSVG("text", {
            x: mx, y: my - 8,
            class: "edge-weight",
            id: `weight-${edgeKey(e.from, e.to)}`
        });
        text.textContent = e.weight + " km";
        edgeGroup.appendChild(text);
    });
    svg.appendChild(edgeGroup);

    // Draw nodes
    const nodeGroup = createSVG("g", { id: "nodes" });
    graphData.nodes.forEach(n => {
        const g = createSVG("g", {
            class: "graph-node",
            id: `node-${n.name.replace(/\s/g, "")}`,
            onclick: `onNodeClick("${n.name}")`
        });

        const circle = createSVG("circle", {
            cx: n.x, cy: n.y, r: 20,
            class: "node-circle",
            fill: "#1e293b",
            stroke: "#475569",
            "stroke-width": 2
        });
        g.appendChild(circle);

        const label = createSVG("text", {
            x: n.x, y: n.y + 4,
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
        updatePrompt("Now click your destination on the map");
    } else if (!endNode) {
        endNode = name;
        document.getElementById("dest-select").value = name;
        highlightNode(name, "end");
        updatePrompt("Click 'Find Shortest Route' or select different nodes");
    } else {
        clearSelection();
        sourceNode = name;
        document.getElementById("source-select").value = name;
        highlightNode(name, "start");
        updatePrompt("Now click your destination on the map");
    }
}

function clearSelection() {
    sourceNode = null;
    endNode = null;
    document.querySelectorAll(".graph-node").forEach(g => {
        g.classList.remove("node-start", "node-end");
    });
    clearPath();
}

function highlightNode(name, type) {
    const id = `node-${name.replace(/\s/g, "")}`;
    const g = document.getElementById(id);
    g.classList.add(type === "start" ? "node-start" : "node-end");
    const circle = g.querySelector(".node-circle");
    circle.setAttribute("fill", type === "start" ? "#22c55e" : "#ef4444");
    circle.setAttribute("stroke", type === "start" ? "#16a34a" : "#dc2626");
}

function updatePrompt(text) {
    document.getElementById("selection-prompt").textContent = text;
}

function clearPath() {
    document.querySelectorAll(".path-line").forEach(el => el.remove());
    document.querySelectorAll(".graph-edge").forEach(el => el.classList.remove("highlighted"));
    document.querySelectorAll(".edge-weight").forEach(el => el.classList.remove("highlighted"));
    document.getElementById("result-panel").classList.add("hidden");
    document.getElementById("result-panel").classList.remove("show");
    document.getElementById("trace-panel").classList.add("hidden");
    document.getElementById("trace-panel").classList.remove("show");
}

document.getElementById("find-route-btn").addEventListener("click", async () => {
    const source = document.getElementById("source-select").value;
    const destination = document.getElementById("dest-select").value;

    if (!source || !destination || source === destination) return;

    sourceNode = source;
    endNode = destination;

    const btn = document.getElementById("find-route-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Calculating...`;

    const res = await fetch(`/api/find-route?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`, { method: "POST" });
    const data = await res.json();

    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 11l19-9-9 19-2-8z"/></svg> Find Shortest Route`;

    if (data.totalDistance < 0) return;

    showResult(data);
});

function showResult(data) {
    // Highlight edges
    clearPath();
    highlightNode(sourceNode, "start");
    highlightNode(endNode, "end");

    data.shortestPathEdges.forEach(key => {
        const edge = document.getElementById(`edge-${key}`);
        const weight = document.getElementById(`weight-${key}`);
        if (edge) edge.classList.add("highlighted");
        if (weight) weight.classList.add("highlighted");
    });

    // Draw animated path lines
    for (let i = 0; i < data.path.length - 1; i++) {
        const from = graphData.nodes.find(n => n.name === data.path[i]);
        const to = graphData.nodes.find(n => n.name === data.path[i + 1]);
        const line = createSVG("line", {
            x1: from.x, y1: from.y,
            x2: to.x, y2: to.y,
            class: "path-line"
        });
        document.getElementById("edges").appendChild(line);
    }

    // Result panel
    const resultPanel = document.getElementById("result-panel");
    resultPanel.classList.remove("hidden");
    resultPanel.classList.add("show");

    const pathHtml = data.path.map((name, i) => {
        return `<span>${name}</span>${i < data.path.length - 1 ? `<span class="arrow">→</span>` : ""}`;
    }).join("");
    document.getElementById("route-path").innerHTML = pathHtml;
    document.getElementById("route-distance").innerHTML = `${data.totalDistance} <span class="unit">km</span>`;

    // Trace panel
    const tracePanel = document.getElementById("trace-panel");
    tracePanel.classList.remove("hidden");
    tracePanel.classList.add("show");

    const traceContainer = document.getElementById("trace-steps");
    traceContainer.innerHTML = "";

    data.trace.forEach((step, idx) => {
        const stepEl = document.createElement("div");
        stepEl.className = "trace-step";
        stepEl.style.animationDelay = `${idx * 0.1}s`;

        let relaxHtml = "";
        step.relaxations.forEach(r => {
            if (r.to === "") {
                relaxHtml += `<div class="trace-relax no-update">No updates needed</div>`;
            } else {
                relaxHtml += `<div class="trace-relax updated">${r.from} → ${r.to} (${r.weight} km, total: ${r.total})</div>`;
            }
        });

        stepEl.innerHTML = `
            <div class="trace-step-header">
                Step ${idx + 1}: Pick <span class="node-name">${step.node}</span> <span class="dist-value">(dist: ${step.distance})</span>
            </div>
            ${relaxHtml}
        `;
        traceContainer.appendChild(stepEl);
    });
}

function createSVG(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

function edgeKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Init
loadGraph();
