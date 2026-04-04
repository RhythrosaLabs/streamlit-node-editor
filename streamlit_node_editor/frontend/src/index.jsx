import { useState, useRef, useCallback, useEffect } from "react";

// ── Port type system (ComfyUI-style color coding) ─────────────────────────────
const PORT_TYPES = {
  IMAGE:   { color: "#4ade80", label: "IMAGE" },
  LATENT:  { color: "#c084fc", label: "LATENT" },
  MODEL:   { color: "#fb923c", label: "MODEL" },
  CLIP:    { color: "#facc15", label: "CLIP" },
  VAE:     { color: "#f87171", label: "VAE" },
  INT:     { color: "#38bdf8", label: "INT" },
  FLOAT:   { color: "#818cf8", label: "FLOAT" },
  STRING:  { color: "#a8a29e", label: "STRING" },
  MASK:    { color: "#2dd4bf", label: "MASK" },
  ANY:     { color: "#71717a", label: "ANY" },
};

// ── Node definitions (the "palette") ──────────────────────────────────────────
const NODE_DEFS = {
  "Load Checkpoint": {
    category: "Loaders",
    color: "#1e293b",
    headerColor: "#fb923c",
    inputs: [],
    outputs: [
      { name: "MODEL", type: "MODEL" },
      { name: "CLIP",  type: "CLIP" },
      { name: "VAE",   type: "VAE" },
    ],
    params: [
      { key: "ckpt_name", label: "Checkpoint", type: "select", options: ["v1-5-pruned.ckpt", "sd_xl_base.safetensors", "dreamshaper_8.safetensors"] },
    ],
  },
  "CLIP Text Encode": {
    category: "Conditioning",
    color: "#1e293b",
    headerColor: "#facc15",
    inputs:  [{ name: "clip", type: "CLIP" }],
    outputs: [{ name: "CONDITIONING", type: "LATENT" }],
    params: [
      { key: "text", label: "Prompt", type: "textarea" },
    ],
  },
  "KSampler": {
    category: "Sampling",
    color: "#1e293b",
    headerColor: "#818cf8",
    inputs: [
      { name: "model",           type: "MODEL" },
      { name: "positive",        type: "LATENT" },
      { name: "negative",        type: "LATENT" },
      { name: "latent_image",    type: "LATENT" },
    ],
    outputs: [{ name: "LATENT", type: "LATENT" }],
    params: [
      { key: "seed",      label: "Seed",      type: "int",   default: 42 },
      { key: "steps",     label: "Steps",     type: "int",   default: 20 },
      { key: "cfg",       label: "CFG",       type: "float", default: 7.0 },
      { key: "sampler",   label: "Sampler",   type: "select", options: ["euler", "euler_a", "dpm++2m", "ddim"] },
      { key: "scheduler", label: "Scheduler", type: "select", options: ["normal", "karras", "exponential"] },
      { key: "denoise",   label: "Denoise",   type: "float", default: 1.0 },
    ],
  },
  "Empty Latent Image": {
    category: "Latent",
    color: "#1e293b",
    headerColor: "#c084fc",
    inputs:  [],
    outputs: [{ name: "LATENT", type: "LATENT" }],
    params: [
      { key: "width",  label: "Width",  type: "int", default: 512 },
      { key: "height", label: "Height", type: "int", default: 512 },
      { key: "batch",  label: "Batch",  type: "int", default: 1 },
    ],
  },
  "VAE Decode": {
    category: "Latent",
    color: "#1e293b",
    headerColor: "#f87171",
    inputs:  [{ name: "samples", type: "LATENT" }, { name: "vae", type: "VAE" }],
    outputs: [{ name: "IMAGE",   type: "IMAGE" }],
    params: [],
  },
  "Save Image": {
    category: "Output",
    color: "#1e293b",
    headerColor: "#4ade80",
    inputs:  [{ name: "images", type: "IMAGE" }],
    outputs: [],
    params: [
      { key: "filename_prefix", label: "Filename", type: "string", default: "output" },
    ],
  },
  "Image Scale": {
    category: "Image",
    color: "#1e293b",
    headerColor: "#2dd4bf",
    inputs:  [{ name: "image", type: "IMAGE" }],
    outputs: [{ name: "IMAGE", type: "IMAGE" }],
    params: [
      { key: "upscale_method", label: "Method", type: "select", options: ["nearest", "bilinear", "bicubic", "lanczos"] },
      { key: "width",  label: "Width",  type: "int", default: 1024 },
      { key: "height", label: "Height", type: "int", default: 1024 },
    ],
  },
  "Integer": {
    category: "Primitives",
    color: "#1e293b",
    headerColor: "#38bdf8",
    inputs:  [],
    outputs: [{ name: "INT", type: "INT" }],
    params: [{ key: "value", label: "Value", type: "int", default: 0 }],
  },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
let _id = 1;
const uid = () => `node_${_id++}`;

function makeNode(type, x, y) {
  const def = NODE_DEFS[type];
  return {
    id: uid(),
    type,
    x, y,
    width: 240,
    params: Object.fromEntries((def.params || []).map(p => [p.key, p.default ?? ""])),
    collapsed: false,
  };
}

function portHeight(index) { return 34 + index * 26; }
function nodeHeight(node) {
  const def = NODE_DEFS[node.type];
  if (node.collapsed) return 36;
  const portRows = Math.max(def.inputs.length, def.outputs.length);
  const paramRows = def.params.length;
  return 36 + portRows * 26 + paramRows * 34 + 12;
}

function getPortPos(node, side, index) {
  const y = node.y + portHeight(index);
  const x = side === "output" ? node.x + node.width : node.x;
  return { x, y };
}

function typesCompatible(a, b) {
  if (a === "ANY" || b === "ANY") return true;
  return a === b;
}

// ── Wire SVG path (cubic bezier) ─────────────────────────────────────────────
function wirePath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.6 + 60;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

// ── Port dot ──────────────────────────────────────────────────────────────────
function Port({ x, y, type, side, connected, onStartWire, onCompleteWire, onRemoveWire }) {
  const c = PORT_TYPES[type]?.color ?? "#71717a";
  return (
    <circle
      cx={x} cy={y} r={6}
      fill={connected ? c : "transparent"}
      stroke={c}
      strokeWidth={2}
      style={{ cursor: "crosshair" }}
      onMouseDown={e => { e.stopPropagation(); onStartWire && onStartWire(e); }}
      onMouseUp={e => { e.stopPropagation(); onCompleteWire && onCompleteWire(e); }}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onRemoveWire && onRemoveWire(); }}
    />
  );
}

// ── Node component ─────────────────────────────────────────────────────────────
function GraphNode({ node, selected, wiring, onSelect, onDragStart,
  onPortMouseDown, onPortMouseUp, connections }) {
  const def = NODE_DEFS[node.type];
  const h = nodeHeight(node);

  const connectedInputs  = new Set(connections.filter(c => c.toNode === node.id).map(c => c.toPort));
  const connectedOutputs = new Set(connections.filter(c => c.fromNode === node.id).map(c => c.fromPort));

  return (
    <g transform={`translate(${node.x},${node.y})`}
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, node.id); onSelect(node.id); }}>

      {/* Shadow */}
      <rect x={3} y={3} width={node.width} height={h} rx={8}
        fill="rgba(0,0,0,0.45)" />

      {/* Body */}
      <rect width={node.width} height={h} rx={8}
        fill={node.collapsed ? def.headerColor + "22" : "#13131f"}
        stroke={selected ? "white" : "rgba(255,255,255,0.12)"}
        strokeWidth={selected ? 1.5 : 1} />

      {/* Header */}
      <rect width={node.width} height={32} rx={8} fill={def.headerColor} opacity={0.9} />
      <rect y={24} width={node.width} height={8} fill={def.headerColor} opacity={0.9} />

      {/* Title */}
      <text x={10} y={21} fontFamily="'Fira Code', monospace" fontSize={12}
        fontWeight={600} fill="rgba(0,0,0,0.85)" style={{ userSelect: "none", pointerEvents: "none" }}>
        {node.type}
      </text>

      {/* Collapse toggle */}
      <text x={node.width - 16} y={21} fontFamily="monospace" fontSize={12}
        fill="rgba(0,0,0,0.6)" style={{ cursor: "pointer", userSelect: "none" }}
        onMouseDown={e => { e.stopPropagation(); }}>
        {node.collapsed ? "+" : "−"}
      </text>

      {!node.collapsed && (
        <>
          {/* Input ports */}
          {def.inputs.map((port, i) => {
            const py = portHeight(i) - node.y + node.y - node.y + 36 + i * 26;
            const relY = 36 + i * 26;
            const c = PORT_TYPES[port.type]?.color ?? "#71717a";
            const isConn = connectedInputs.has(i);
            return (
              <g key={`in-${i}`}>
                <circle cx={0} cy={relY} r={6}
                  fill={isConn ? c : "transparent"} stroke={c} strokeWidth={2}
                  style={{ cursor: "crosshair" }}
                  onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, "input", i, port.type); }}
                  onMouseUp={e => { e.stopPropagation(); onPortMouseUp(e, node.id, "input", i, port.type); }}
                />
                <text x={12} y={relY + 4} fontFamily="'Fira Code', monospace"
                  fontSize={10} fill={c} style={{ userSelect: "none", pointerEvents: "none" }}>
                  {port.name}
                </text>
              </g>
            );
          })}

          {/* Output ports */}
          {def.outputs.map((port, i) => {
            const relY = 36 + i * 26;
            const c = PORT_TYPES[port.type]?.color ?? "#71717a";
            const isConn = connectedOutputs.has(i);
            return (
              <g key={`out-${i}`}>
                <circle cx={node.width} cy={relY} r={6}
                  fill={isConn ? c : "transparent"} stroke={c} strokeWidth={2}
                  style={{ cursor: "crosshair" }}
                  onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, "output", i, port.type); }}
                  onMouseUp={e => { e.stopPropagation(); onPortMouseUp(e, node.id, "output", i, port.type); }}
                />
                <text x={node.width - 12} y={relY + 4} fontFamily="'Fira Code', monospace"
                  fontSize={10} fill={c} textAnchor="end"
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {port.name}
                </text>
              </g>
            );
          })}

          {/* Params */}
          {def.params.map((param, i) => {
            const baseY = 36 + Math.max(def.inputs.length, def.outputs.length) * 26 + i * 34 + 8;
            return (
              <foreignObject key={param.key} x={8} y={baseY} width={node.width - 16} height={30}
                style={{ pointerEvents: "all" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <label style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, color: "#64748b",
                    minWidth: 52, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {param.label}
                  </label>
                  {param.type === "select" ? (
                    <select
                      value={node.params[param.key] ?? ""}
                      onChange={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, color: "#e2e8f0", fontFamily: "'Fira Code', monospace",
                        fontSize: 10, padding: "2px 4px", outline: "none" }}>
                      {param.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : param.type === "textarea" ? (
                    <textarea rows={2}
                      defaultValue={node.params[param.key] ?? ""}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, color: "#e2e8f0", fontFamily: "'Fira Code', monospace",
                        fontSize: 10, padding: "2px 4px", outline: "none", resize: "none" }} />
                  ) : (
                    <input type={param.type === "float" || param.type === "int" ? "number" : "text"}
                      defaultValue={node.params[param.key] ?? ""}
                      step={param.type === "float" ? 0.1 : 1}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4, color: "#e2e8f0", fontFamily: "'Fira Code', monospace",
                        fontSize: 10, padding: "2px 4px", outline: "none" }} />
                  )}
                </div>
              </foreignObject>
            );
          })}
        </>
      )}
    </g>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────
export default function NodeEditor() {
  const [nodes, setNodes] = useState(() => {
    const n1 = makeNode("Load Checkpoint", 60, 80);
    const n2 = makeNode("CLIP Text Encode", 360, 60);
    const n3 = makeNode("CLIP Text Encode", 360, 240);
    const n4 = makeNode("Empty Latent Image", 360, 440);
    const n5 = makeNode("KSampler", 680, 200);
    const n6 = makeNode("VAE Decode", 1000, 300);
    const n7 = makeNode("Save Image", 1260, 320);
    n3.params.text = "blurry, bad quality, ugly";
    return [n1, n2, n3, n4, n5, n6, n7];
  });

  const [connections, setConnections] = useState(() => [
    { id: "w1", fromNode: null, fromPort: 0, toNode: null, toPort: 0 }, // will fix below
  ].slice(0)); // placeholder — will be empty, nodes wired via UI

  const [selected, setSelected] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingNode, setDraggingNode] = useState(null); // { id, startX, startY, mouseX, mouseY }
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [wiring, setWiring] = useState(null); // { fromNode, fromPort, fromSide, fromType, x, y }
  const [wirePos, setWirePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null); // { x, y }
  const [palette, setPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const svgRef = useRef(null);

  // ── SVG coordinate helpers ──────────────────────────────────────────────────
  const svgPoint = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const svgRaw = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Drag node ──────────────────────────────────────────────────────────────
  const handleNodeDragStart = useCallback((e, id) => {
    if (wiring) return;
    const pt = svgPoint(e);
    const node = nodes.find(n => n.id === id);
    setDraggingNode({ id, offsetX: pt.x - node.x, offsetY: pt.y - node.y });
  }, [nodes, svgPoint, wiring]);

  // ── Pan canvas ────────────────────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && !wiring)) {
      if (e.button !== 2) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
      setSelected(null);
    }
  }, [pan, wiring]);

  // ── Mouse move ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (draggingNode) {
      const pt = svgPoint(e);
      setNodes(ns => ns.map(n => n.id === draggingNode.id
        ? { ...n, x: pt.x - draggingNode.offsetX, y: pt.y - draggingNode.offsetY }
        : n
      ));
    }
    if (isPanning && panStart) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (wiring) {
      const raw = svgRaw(e);
      setWirePos(raw);
    }
  }, [draggingNode, isPanning, panStart, wiring, svgPoint, svgRaw]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
    setIsPanning(false);
    if (wiring) setWiring(null);
  }, [wiring]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  }, []);

  // ── Port interactions ──────────────────────────────────────────────────────
  const handlePortMouseDown = useCallback((e, nodeId, side, portIndex, portType) => {
    const raw = svgRaw(e);
    setWiring({ fromNode: nodeId, fromPort: portIndex, fromSide: side, fromType: portType });
    setWirePos(raw);
  }, [svgRaw]);

  const handlePortMouseUp = useCallback((e, nodeId, side, portIndex, portType) => {
    if (!wiring) return;
    // Must connect output → input
    const isOutputToInput = wiring.fromSide === "output" && side === "input";
    const isInputToOutput = wiring.fromSide === "input"  && side === "output";
    if (!(isOutputToInput || isInputToOutput)) { setWiring(null); return; }
    if (wiring.fromNode === nodeId) { setWiring(null); return; }
    if (!typesCompatible(wiring.fromType, portType)) { setWiring(null); return; }

    const fromNode = isOutputToInput ? wiring.fromNode : nodeId;
    const fromPort = isOutputToInput ? wiring.fromPort : portIndex;
    const toNode   = isOutputToInput ? nodeId : wiring.fromNode;
    const toPort   = isOutputToInput ? portIndex : wiring.fromPort;

    setConnections(cs => [
      ...cs.filter(c => !(c.toNode === toNode && c.toPort === toPort)), // replace existing input conn
      { id: `w${Date.now()}`, fromNode, fromPort, toNode, toPort },
    ]);
    setWiring(null);
  }, [wiring]);

  // ── Context menu (right-click canvas) ────────────────────────────────────
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const raw = svgRaw(e);
    setContextMenu({ x: e.clientX, y: e.clientY, svgX: raw.x, svgY: raw.y });
  }, [svgRaw]);

  // ── Add node ──────────────────────────────────────────────────────────────
  const addNode = useCallback((type, rawX, rawY) => {
    const pt = {
      x: (rawX - pan.x) / zoom,
      y: (rawY - pan.y) / zoom,
    };
    setNodes(ns => [...ns, makeNode(type, pt.x - 120, pt.y - 18)]);
    setContextMenu(null);
    setPalette(false);
  }, [pan, zoom]);

  // ── Delete selected node ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        setNodes(ns => ns.filter(n => n.id !== selected));
        setConnections(cs => cs.filter(c => c.fromNode !== selected && c.toNode !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  // ── Wire geometry ─────────────────────────────────────────────────────────
  const getWireEndpoints = (conn) => {
    const fromNode = nodes.find(n => n.id === conn.fromNode);
    const toNode   = nodes.find(n => n.id === conn.toNode);
    if (!fromNode || !toNode) return null;
    const from = getPortPos(fromNode, "output", conn.fromPort);
    const to   = getPortPos(toNode,   "input",  conn.toPort);
    return { from, to };
  };

  const getWireColor = (conn) => {
    const fromNode = nodes.find(n => n.id === conn.fromNode);
    if (!fromNode) return "#71717a";
    const def = NODE_DEFS[fromNode.type];
    const port = def.outputs[conn.fromPort];
    return PORT_TYPES[port?.type]?.color ?? "#71717a";
  };

  // ── Filtered palette ──────────────────────────────────────────────────────
  const filteredDefs = Object.entries(NODE_DEFS).filter(([name]) =>
    name.toLowerCase().includes(paletteSearch.toLowerCase())
  );
  const categories = [...new Set(filteredDefs.map(([, d]) => d.category))];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        select option { background: #0f0f1a; }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", background: "#080810", overflow: "hidden",
        fontFamily: "'Fira Code', monospace", position: "relative", userSelect: "none" }}>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 8, zIndex: 100, alignItems: "center" }}>
          <div style={{ background: "rgba(15,15,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "6px 14px", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em" }}>NODE GRAPH</span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
            <button onClick={() => { setPalette(p => !p); setContextMenu(null); }} style={{
              background: palette ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${palette ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 6, color: palette ? "#818cf8" : "#94a3b8",
              padding: "4px 12px", cursor: "pointer", fontSize: 11, letterSpacing: "0.05em"
            }}>+ ADD NODE</button>
            <span style={{ fontSize: 10, color: "#334155" }}>Right-click canvas to add · Del to remove · Drag ports to connect</span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 10, color: "#475569" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5,
                color: "#475569", padding: "3px 8px", cursor: "pointer", fontSize: 10 }}>RESET</button>
          </div>
        </div>

        {/* ── Node palette ──────────────────────────────────────────────── */}
        {palette && (
          <div style={{ position: "absolute", top: 60, left: 20, width: 220,
            background: "rgba(13,13,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, zIndex: 200, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ padding: "10px 12px 8px" }}>
              <input autoFocus value={paletteSearch} onChange={e => setPaletteSearch(e.target.value)}
                placeholder="Search nodes…"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: "#e2e8f0", fontFamily: "'Fira Code', monospace", fontSize: 11,
                  padding: "6px 10px", outline: "none" }} />
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto", paddingBottom: 8 }}>
              {categories.map(cat => (
                <div key={cat}>
                  <div style={{ padding: "4px 12px 2px", fontSize: 9, color: "#475569",
                    letterSpacing: "0.15em", textTransform: "uppercase" }}>{cat}</div>
                  {filteredDefs.filter(([, d]) => d.category === cat).map(([name, def]) => (
                    <div key={name} onClick={() => addNode(name, window.innerWidth / 2, window.innerHeight / 2)}
                      style={{ padding: "6px 12px", cursor: "pointer", display: "flex",
                        alignItems: "center", gap: 8, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: def.headerColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#cbd5e1" }}>{name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Port type legend ──────────────────────────────────────────── */}
        <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 100,
          background: "rgba(13,13,25,0.9)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8, padding: "8px 12px", display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 500 }}>
          {Object.entries(PORT_TYPES).filter(([k]) => k !== "ANY").map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.05em" }}>{k}</span>
            </div>
          ))}
        </div>

        {/* ── Context menu ─────────────────────────────────────────────── */}
        {contextMenu && (
          <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y,
            background: "rgba(13,13,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, zIndex: 300, overflow: "hidden", minWidth: 200,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
            onMouseLeave={() => setContextMenu(null)}>
            <div style={{ padding: "6px 12px 4px", fontSize: 9, color: "#475569", letterSpacing: "0.15em" }}>
              ADD NODE
            </div>
            {Object.entries(NODE_DEFS).map(([name, def]) => (
              <div key={name}
                onClick={() => addNode(name, contextMenu.svgX, contextMenu.svgY)}
                style={{ padding: "6px 14px", cursor: "pointer", fontSize: 11, color: "#cbd5e1",
                  display: "flex", alignItems: "center", gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: def.headerColor, flexShrink: 0 }} />
                {name}
              </div>
            ))}
          </div>
        )}

        {/* ── Canvas SVG ───────────────────────────────────────────────── */}
        <svg ref={svgRef} width="100%" height="100%"
          style={{ cursor: isPanning ? "grabbing" : wiring ? "crosshair" : "default" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          onClick={() => setContextMenu(null)}>

          <defs>
            <pattern id="grid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (40 * zoom)} y={pan.y % (40 * zoom)}>
              <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`}
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

            {/* Connections */}
            {connections.map(conn => {
              const pts = getWireEndpoints(conn);
              if (!pts) return null;
              const color = getWireColor(conn);
              return (
                <path key={conn.id}
                  d={wirePath(pts.from.x, pts.from.y, pts.to.x, pts.to.y)}
                  fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.85}
                  style={{ cursor: "pointer" }}
                  onClick={e => { e.stopPropagation(); setConnections(cs => cs.filter(c => c.id !== conn.id)); }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => (
              <GraphNode key={node.id} node={node}
                selected={selected === node.id}
                wiring={wiring}
                connections={connections}
                onSelect={setSelected}
                onDragStart={handleNodeDragStart}
                onPortMouseDown={handlePortMouseDown}
                onPortMouseUp={handlePortMouseUp}
              />
            ))}
          </g>

          {/* Live wire being dragged */}
          {wiring && (() => {
            const fromNode = nodes.find(n => n.id === wiring.fromNode);
            if (!fromNode) return null;
            const from = getPortPos(fromNode, wiring.fromSide, wiring.fromPort);
            const fx = from.x * zoom + pan.x;
            const fy = from.y * zoom + pan.y;
            const color = PORT_TYPES[wiring.fromType]?.color ?? "#71717a";
            return (
              <path d={wirePath(fx, fy, wirePos.x, wirePos.y)}
                fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.7}
                strokeDasharray="6 3" />
            );
          })()}
        </svg>
      </div>
    </>
  );
}
