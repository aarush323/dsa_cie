let graphData = null;
let sourceNode = null;
let endNode = null;

const SVG_NS = "http://www.w3.org/2000/svg";

async function loadGraph() {
    try {
        const res = await fetch("/api/graph");
        graphData = await res.json();

        // Dynamically adjust SVG viewbox based on node extremes to center map nicely
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

    const padding = 120;
    svg.setAttribute("viewBox", `${minX - padding} ${minY - padding} ${(maxX - minX) + padding * 2} ${(maxY - minY) + padding * 2}`);
}

function populateDropdowns() {
    const src = document.getElementById("source-select");
    const dst = document.getElementById("dest-select");

    // Add default placeholders
    src.innerHTML = `<option value="" disabled selected>Select Starting Point...</option>`;
    dst.innerHTML = `<option value="" disabled selected>Select Destination...</option>`;

    graphData.nodes.forEach((n) => {
        src.innerHTML += `<option value="${n.name}">${n.name}</option>`;
        dst.innerHTML += `<option value="${n.name}">${n.name}</option>`;
    });

    // Event listeners for selects
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

    // Defs for filters
    const defs = createSVG("defs");
    // Drop shadow filter for nodes
    const filter = createSVG("filter", { id: "drop-shadow" });
    filter.innerHTML = `
        <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
        <feOffset dx="0" dy="4" result="offsetblur"/>
        <feComponentTransfer>
            <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
        <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `;
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Draw edges first (so they are beneath nodes)
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

    // Draw weights grouped cleanly
    graphData.edges.forEach(e => {
        const from = graphData.nodes.find(n => n.name === e.from);
        const to = graphData.nodes.find(n => n.name === e.to);
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;

        const bg = createSVG("rect", {
            x: mx - 18, y: my - 12,
            width: 36, height: 16,
            rx: 6, fill: "var(--edge-bg)"
        });
        edgeGroup.appendChild(bg);

        const text = createSVG("text", {
            x: mx, y: my,
            class: "edge-weight",
            id: `weight-${edgeKey(e.from, e.to)}`
        });
        text.textContent = e.weight + "km";
        edgeGroup.appendChild(text);
    });

    svg.appendChild(edgeGroup);

    // Dynamic paths layer (will draw on top of base edges)
    svg.appendChild(createSVG("g", { id: "dynamic-paths" }));

    // Draw nodes
    const nodeGroup = createSVG("g", { id: "nodes" });
    graphData.nodes.forEach(n => {
        const g = createSVG("g", {
            class: "graph-node",
            id: `node-${n.name.replace(/\s/g, "")}`,
        });

        // Click handler inside closure to maintain scope
        g.addEventListener('click', () => onNodeClick(n.name));

        const circle = createSVG("circle", {
            cx: n.x, cy: n.y, r: 16,
            class: "node-circle",
            fill: "var(--node-bg)",
            stroke: "var(--node-border)",
            "stroke-width": 2,
            filter: "url(#drop-shadow)"
        });
        g.appendChild(circle);

        const label = createSVG("text", {
            x: n.x, y: n.y + 32,
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
        // Reset and start over
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
        prompt.textContent = "Ready! Click 'Find Shortest Route'";
        prompt.classList.remove("hidden");
    }
}

function clearNodeStyling(name) {
    const id = `node-${name.replace(/\s/g, "")}`;
    const g = document.getElementById(id);
    if (g) {
        g.classList.remove("node-start", "node-end");
        const circle = g.querySelector(".node-circle");
        circle.setAttribute("fill", "var(--node-bg)");
        circle.setAttribute("stroke", "var(--node-border)");
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
    const circle = g.querySelector(".node-circle");

    // Explicit color settings handled primarily by CSS classes now
    // CSS uses !important for these to enforce them properly
    const highlightFill = type === "start" ? "var(--success)" : "var(--danger)";
    const highlightStroke = type === "start" ? "var(--success-trans)" : "var(--danger-trans)";
    circle.setAttribute("fill", highlightFill);
    circle.setAttribute("stroke", highlightStroke);
}

function clearPath() {
    document.getElementById("dynamic-paths").innerHTML = "";
    document.querySelectorAll(".graph-edge").forEach(el => el.classList.remove("highlighted"));
    document.querySelectorAll(".edge-weight").forEach(el => el.classList.remove("highlighted"));
}

document.getElementById("find-route-btn").addEventListener("click", async () => {
    if (!sourceNode || !endNode || sourceNode === endNode) {
        // Maybe highlight or shake the input box gently
        document.getElementById("selection-prompt").textContent = "Please select distinct Source and Destination!";
        return;
    }

    const btn = document.getElementById("find-route-btn");
    btn.disabled = true;
    btn.innerHTML = `Calculating Path...`;

    try {
        const res = await fetch(`/api/find-route?source=${encodeURIComponent(sourceNode)}&destination=${encodeURIComponent(endNode)}`, { method: "POST" });
        const data = await res.json();

        if (data.totalDistance >= 0) {
            drawResultPath(data);
            showResultModal(data);
        }
    } catch (e) {
        console.error("Failed to find route", e);
    }

    btn.disabled = false;
    btn.innerHTML = `Find Shortest Route`;
});

function drawResultPath(data) {
    clearPath();

    // Base edge highlights
    data.shortestPathEdges.forEach(key => {
        const edge = document.getElementById(`edge-${key}`);
        const weight = document.getElementById(`weight-${key}`);
        if (edge) edge.classList.add("highlighted");
        if (weight) weight.classList.add("highlighted");
    });

    // Draw connected dynamic path over layers
    const dynamicGroup = document.getElementById("dynamic-paths");

    let pathString = "";
    data.path.forEach((nodeName, idx) => {
        const p = graphData.nodes.find(n => n.name === nodeName);
        if (idx === 0) pathString += `M ${p.x} ${p.y} `;
        else pathString += `L ${p.x} ${p.y} `;
    });

    const animatedLine = createSVG("path", {
        d: pathString,
        class: "path-line"
    });

    dynamicGroup.appendChild(animatedLine);
}

function showResultModal(data) {
    const modal = document.getElementById("modal-overlay");
    const wrapper = document.getElementById("result-wrapper");

    // Set properties
    const pathHtml = data.path.map((name, i) => {
        return `<span>${name}</span>${i < data.path.length - 1 ? `<span class="arrow">➔</span>` : ""}`;
    }).join("");

    document.getElementById("route-path").innerHTML = pathHtml;
    document.getElementById("route-distance").innerHTML = `${data.totalDistance} <span class="unit">km</span>`;

    // Set trace
    const traceContainer = document.getElementById("trace-steps");
    traceContainer.innerHTML = "";

    data.trace.forEach((step, idx) => {
        const stepEl = document.createElement("div");
        stepEl.className = "trace-step";

        let relaxHtml = "";
        step.relaxations.forEach(r => {
            if (r.to === "") {
                relaxHtml += `<div class="trace-relax no-update">No outgoing edges evaluated.</div>`;
            } else {
                relaxHtml += `<div class="trace-relax ${r.updated ? 'updated' : 'skipped'}">` +
                    `<span class="edge-path">${r.from} ➔ ${r.to}</span> ` +
                    `<span class="edge-detail">(+${r.weight}km)</span> ` +
                    `${r.updated ? `<span class="action-icon">✓</span> <span class="new-dist">New distance: ${r.total}</span>` : `<span class="action-icon">✗</span> <span class="skip-dist">Kept existing</span>`}` +
                    `</div>`;
            }
        });

        stepEl.innerHTML = `
            <div class="trace-step-header">
                <span class="step-num">Step ${idx + 1}</span>
                <span class="step-action">Visiting <strong>${step.node}</strong></span>
                <span class="step-dist">Current Dist: ${step.distance}</span>
            </div>
            <div class="trace-relax-list">
                ${relaxHtml}
            </div>
        `;
        traceContainer.appendChild(stepEl);
    });

    // Show
    document.getElementById("selection-prompt").classList.add("hidden");
    modal.classList.remove("hidden");
    wrapper.classList.remove("hidden");
}

function hideModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.getElementById("result-wrapper").classList.add("hidden");
    checkPromptState();
}

document.getElementById("close-modal").addEventListener("click", hideModal);
document.getElementById("action-replan").addEventListener("click", () => {
    hideModal();
    clearSelection();
    checkPromptState();
});

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

// Theme Management
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = document.querySelector('.theme-icon-sun');
const moonIcon = document.querySelector('.theme-icon-moon');

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
    if (themeName === 'light') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

// Initialize theme from storage or default to dark
const currentTheme = localStorage.getItem('theme') || 'dark';
setTheme(currentTheme);

themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    setTheme(isDark ? 'light' : 'dark');
});

// Init
checkPromptState();
loadGraph();
