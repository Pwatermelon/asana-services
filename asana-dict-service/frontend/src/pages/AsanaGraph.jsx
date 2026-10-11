import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import '../styles/AsanaGraph.css';

const COLORS = {
  node: '#6366f1',
  nodeActive: '#8b5cf6',
  nodeMatch: '#a855f7',
  edge: 'rgba(99, 102, 241, 0.45)',
  edgeInferred: 'rgba(245, 158, 11, 0.5)',
  label: '#0f172a',
  dim: 'rgba(99, 102, 241, 0.12)',
};

function connectedComponents(nodes, edges) {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    let cur = x;
    while (cur !== r) {
      const next = parent.get(cur);
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const e of edges) union(e.source, e.target);
  const groups = new Map();
  for (const n of nodes) {
    const r = find(n.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(n);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

const AsanaGraph = () => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const hoverIdRef = useRef(null);
  const selectedIdRef = useRef(null);
  const matchIdsRef = useRef(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [includeInferred, setIncludeInferred] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return nodes
      .filter((n) => {
        const hay = `${n.label} ${n.name_sanskrit || ''} ${n.short_id || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [nodes, query]);

  const focusNode = useCallback((nodeOrId) => {
    const api = simRef.current;
    if (!api?.focus) return;
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
    api.focus(id);
    const node = nodes.find((n) => n.id === id);
    if (node) {
      selectedIdRef.current = id;
      setSelected(node);
    }
    setSearchOpen(false);
  }, [nodes]);

  const runSearch = useCallback(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      matchIdsRef.current = new Set();
      return;
    }
    const hits = nodes.filter((n) => {
      const hay = `${n.label} ${n.name_sanskrit || ''} ${n.short_id || ''}`.toLowerCase();
      return hay.includes(q);
    });
    matchIdsRef.current = new Set(hits.map((h) => h.id));
    if (hits[0]) focusNode(hits[0]);
  }, [query, nodes, focusNode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    selectedIdRef.current = null;
    matchIdsRef.current = new Set();
    try {
      const { data } = await apiClient.get('/api/admin/asana-graph', {
        params: { include_inferred: includeInferred, only_linked: true },
      });
      setStats(data.stats || null);
      setNodes(data.nodes || []);
      initSimulation(data.nodes || [], data.edges || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Не удалось загрузить граф');
      setNodes([]);
      initSimulation([], []);
    } finally {
      setLoading(false);
    }
  }, [includeInferred]);

  const initSimulation = (rawNodes, rawEdges) => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const w = Math.max(wrap.clientWidth || 900, 640);
    const h = Math.max(620, wrap.clientHeight || 640);
    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    const comps = connectedComponents(rawNodes, rawEdges);
    const cols = Math.max(1, Math.ceil(Math.sqrt(comps.length)));
    const rows = Math.ceil(comps.length / cols);
    const cellW = Math.max(520, (w * 2.2) / cols);
    const cellH = Math.max(440, (h * 2.2) / rows);

    const nodeById = new Map();
    const simNodes = [];

    comps.forEach((group, gi) => {
      const col = gi % cols;
      const row = Math.floor(gi / cols);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const spread = Math.max(120, Math.sqrt(group.length) * 72);
      group.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(group.length, 1);
        const r = spread * (0.35 + 0.65 * Math.sqrt((i + 1) / Math.max(group.length, 1)));
        const node = {
          ...n,
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          vx: 0,
          vy: 0,
          cx,
          cy,
        };
        nodeById.set(n.id, node);
        simNodes.push(node);
      });
    });

    const simEdges = rawEdges
      .map((e) => ({
        ...e,
        source: nodeById.get(e.source),
        target: nodeById.get(e.target),
      }))
      .filter((e) => e.source && e.target);

    const worldW = cols * cellW;
    const worldH = rows * cellH;
    const fitK = Math.min(w / (worldW + 120), h / (worldH + 120));
    const camera = {
      x: w / 2 - (worldW / 2) * Math.min(1.1, Math.max(0.45, fitK)),
      y: h / 2 - (worldH / 2) * Math.min(1.1, Math.max(0.45, fitK)),
      k: Math.min(1.1, Math.max(0.45, fitK)),
    };

    let dragging = null;
    let panning = null;
    let raf = 0;
    let ticks = 0;
    const maxForceTicks = 520;
    const idealEdge = 200;
    const minDist = 96;

    const screenToWorld = (sx, sy) => ({
      x: (sx - camera.x) / camera.k,
      y: (sy - camera.y) / camera.k,
    });

    const findNode = (sx, sy) => {
      const p = screenToWorld(sx, sy);
      let best = null;
      let bestD = 18 / camera.k;
      for (const n of simNodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };

    const focus = (id) => {
      const node = nodeById.get(id);
      if (!node) return;
      camera.k = Math.max(camera.k, 1.15);
      camera.x = w / 2 - node.x * camera.k;
      camera.y = h / 2 - node.y * camera.k;
      selectedIdRef.current = id;
      matchIdsRef.current = new Set([id]);
    };

    const tick = () => {
      ticks += 1;
      const cooling = ticks < maxForceTicks;
      const alpha = cooling ? Math.max(0.02, 1 - ticks / maxForceTicks) : 0;
      const n = simNodes.length;

      if (cooling && n > 0) {
        // repulsion (sampled for large graphs)
        const step = n > 180 ? 2 : 1;
        for (let i = 0; i < n; i += step) {
          for (let j = i + 1; j < n; j += step) {
            const a = simNodes[i];
            const b = simNodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.hypot(dx, dy) || 0.01;
            if (dist < minDist * 4) {
              const strength =
                dist < minDist
                  ? ((minDist - dist) / dist) * 0.18 * alpha
                  : (1400 / (dist * dist)) * alpha;
              dx = (dx / dist) * strength;
              dy = (dy / dist) * strength;
              a.vx -= dx;
              a.vy -= dy;
              b.vx += dx;
              b.vy += dy;
            }
          }
        }
        for (const e of simEdges) {
          const a = e.source;
          const b = e.target;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const f = (dist - idealEdge) * 0.012 * alpha;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
        for (const node of simNodes) {
          if (node === dragging) continue;
          node.vx += (node.cx - node.x) * 0.004 * alpha;
          node.vy += (node.cy - node.y) * 0.004 * alpha;
          node.vx *= 0.82;
          node.vy *= 0.82;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      ctx.clearRect(0, 0, w, h);
      // subtle grid
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.k, camera.k);

      const matchSet = matchIdsRef.current;
      const selectedId = selectedIdRef.current;
      const hoverId = hoverIdRef.current;

      for (const e of simEdges) {
        const hi =
          matchSet.has(e.source.id) ||
          matchSet.has(e.target.id) ||
          selectedId === e.source.id ||
          selectedId === e.target.id;
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = e.kind === 'inferred' ? COLORS.edgeInferred : COLORS.edge;
        ctx.globalAlpha = hi ? 0.95 : 0.55;
        ctx.lineWidth = (hi ? 2.4 : 1.6) / camera.k;
        ctx.setLineDash(e.kind === 'inferred' ? [7 / camera.k, 5 / camera.k] : []);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const node of simNodes) {
        const active = selectedId === node.id || hoverId === node.id;
        const matched = matchSet.has(node.id);
        const radius = (active || matched ? 10 : 7) / Math.min(camera.k, 1.4);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        if (matched && !active) {
          ctx.fillStyle = COLORS.nodeMatch;
        } else if (active) {
          ctx.fillStyle = COLORS.nodeActive;
        } else {
          ctx.fillStyle = COLORS.node;
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / camera.k;
        ctx.setLineDash([]);
        ctx.stroke();

        if (camera.k > 0.45 || active || matched) {
          ctx.fillStyle = COLORS.label;
          ctx.font = `${Math.max(11, 13 / camera.k)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.label.slice(0, 32), node.x, node.y - radius - 6 / camera.k);
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const factor = ev.deltaY < 0 ? 1.1 : 0.9;
      const next = Math.min(3.5, Math.max(0.15, camera.k * factor));
      camera.x = mx - ((mx - camera.x) / camera.k) * next;
      camera.y = my - ((my - camera.y) / camera.k) * next;
      camera.k = next;
    };

    const onDown = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const hit = findNode(sx, sy);
      if (hit) {
        dragging = hit;
        selectedIdRef.current = hit.id;
        setSelected({ ...hit });
        hit.vx = 0;
        hit.vy = 0;
      } else {
        panning = { x: sx, y: sy, cx: camera.x, cy: camera.y };
      }
    };

    const onMove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      if (dragging) {
        const p = screenToWorld(sx, sy);
        dragging.x = p.x;
        dragging.y = p.y;
        dragging.vx = 0;
        dragging.vy = 0;
      } else if (panning) {
        camera.x = panning.cx + (sx - panning.x);
        camera.y = panning.cy + (sy - panning.y);
      } else {
        const hit = findNode(sx, sy);
        hoverIdRef.current = hit?.id || null;
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    };

    const onUp = () => {
      dragging = null;
      panning = null;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    raf = requestAnimationFrame(tick);

    if (simRef.current?.cleanup) simRef.current.cleanup();
    simRef.current = {
      focus,
      cleanup: () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      },
    };
  };

  useEffect(() => {
    load();
    return () => simRef.current?.cleanup?.();
  }, [load]);

  return (
    <div className="container asana-graph-page">
      <div className="asana-graph-header">
        <div>
          <p className="asana-graph-crumb">
            <Link to="/admin">Админ</Link> / Граф асан
          </p>
          <h1>Граф связей isSameAsObject</h1>
          <p className="asana-graph-lead">
            Узлы — асаны, рёбра — sameAs между фото. Компоненты разнесены по сетке. Поиск подсвечивает
            и центрирует узел.
          </p>
        </div>
        <div className="asana-graph-controls">
          <label className="asana-graph-check">
            <input
              type="checkbox"
              checked={includeInferred}
              onChange={(e) => setIncludeInferred(e.target.checked)}
            />
            Показать inferred
          </label>
          <button type="button" className="asana-graph-btn" onClick={load} disabled={loading}>
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
      </div>

      <div className="asana-graph-search">
        <input
          type="search"
          placeholder="Поиск асаны по названию, санскриту или id…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
        />
        <button type="button" className="asana-graph-btn" onClick={runSearch}>
          Найти
        </button>
        {searchOpen && suggestions.length > 0 && (
          <ul className="asana-graph-suggest">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(s.label);
                    focusNode(s);
                    matchIdsRef.current = new Set([s.id]);
                  }}
                >
                  <strong>{s.label}</strong>
                  <span>{s.name_sanskrit || s.short_id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="asana-graph-error">{error}</div>}

      {stats && (
        <div className="asana-graph-stats">
          <span>Узлов: {stats.nodes}</span>
          <span>Рёбер: {stats.edges}</span>
          <span>Пар фото: {stats.photo_pairs}</span>
        </div>
      )}

      <div className="asana-graph-layout">
        <div className="asana-graph-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} className="asana-graph-canvas" />
        </div>
        <aside className="asana-graph-side">
          <h2>Выбранный узел</h2>
          {selected ? (
            <>
              <p className="asana-graph-side-label">{selected.label}</p>
              {selected.name_sanskrit && (
                <p className="asana-graph-side-meta">{selected.name_sanskrit}</p>
              )}
              <p className="asana-graph-side-id">{selected.short_id}</p>
              <Link
                className="asana-graph-btn asana-graph-btn--link"
                to={`/asana/${encodeURIComponent(selected.id)}`}
              >
                Открыть карточку
              </Link>
            </>
          ) : (
            <p className="asana-graph-side-empty">Кликните по точке или найдите через поиск</p>
          )}
          <div className="asana-graph-legend">
            <div>
              <i className="asana-graph-legend-dot" /> узел
            </div>
            <div>
              <i className="asana-graph-legend-line" /> asserted
            </div>
            <div>
              <i className="asana-graph-legend-line asana-graph-legend-line--dash" /> inferred
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AsanaGraph;
