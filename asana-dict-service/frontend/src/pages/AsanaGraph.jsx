import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import '../styles/AsanaGraph.css';

const AsanaGraph = () => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const hoverIdRef = useRef(null);
  const selectedIdRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [includeInferred, setIncludeInferred] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      const { data } = await apiClient.get('/api/admin/asana-graph', {
        params: { include_inferred: includeInferred, only_linked: true },
      });
      setStats(data.stats || null);
      initSimulation(data.nodes || [], data.edges || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Не удалось загрузить граф');
      initSimulation([], []);
    } finally {
      setLoading(false);
    }
  }, [includeInferred]);

  const initSimulation = (nodes, edges) => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const w = wrap.clientWidth || 900;
    const h = Math.max(520, wrap.clientHeight || 560);
    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    const nodeById = new Map();
    const simNodes = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      const r = Math.min(w, h) * 0.28;
      const node = {
        ...n,
        x: w / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: h / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
      nodeById.set(n.id, node);
      return node;
    });

    const simEdges = edges
      .map((e) => ({
        ...e,
        source: nodeById.get(e.source),
        target: nodeById.get(e.target),
      }))
      .filter((e) => e.source && e.target);

    const camera = { x: 0, y: 0, k: 1 };
    let dragging = null;
    let panning = null;
    let raf = 0;

    const screenToWorld = (sx, sy) => ({
      x: (sx - camera.x) / camera.k,
      y: (sy - camera.y) / camera.k,
    });

    const findNode = (sx, sy) => {
      const p = screenToWorld(sx, sy);
      let best = null;
      let bestD = 14 / camera.k;
      for (const n of simNodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };

    const tick = () => {
      const n = simNodes.length;
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = simNodes[i];
            const b = simNodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.hypot(dx, dy) || 0.01;
            const minDist = 48;
            if (dist < minDist) {
              const f = ((minDist - dist) / dist) * 0.05;
              dx *= f;
              dy *= f;
              a.vx -= dx;
              a.vy -= dy;
              b.vx += dx;
              b.vy += dy;
            } else {
              const f = 18 / (dist * dist);
              a.vx -= (dx / dist) * f;
              a.vy -= (dy / dist) * f;
              b.vx += (dx / dist) * f;
              b.vy += (dy / dist) * f;
            }
          }
        }
        for (const e of simEdges) {
          const a = e.source;
          const b = e.target;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const f = (dist - 90) * 0.008;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
        for (const node of simNodes) {
          if (node === dragging) continue;
          node.vx += (w / 2 - node.x) * 0.0015;
          node.vy += (h / 2 - node.y) * 0.0015;
          node.vx *= 0.86;
          node.vy *= 0.86;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.k, camera.k);

      for (const e of simEdges) {
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = e.kind === 'inferred' ? 'rgba(120, 90, 40, 0.35)' : 'rgba(45, 90, 70, 0.55)';
        ctx.lineWidth = e.kind === 'inferred' ? 1.2 / camera.k : 1.8 / camera.k;
        if (e.kind === 'inferred') ctx.setLineDash([6 / camera.k, 4 / camera.k]);
        else ctx.setLineDash([]);
        ctx.stroke();
      }

      for (const node of simNodes) {
        const active =
          selectedIdRef.current === node.id || hoverIdRef.current === node.id;
        ctx.beginPath();
        ctx.arc(node.x, node.y, active ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#2d5a46' : '#4a7c66';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 / camera.k;
        ctx.setLineDash([]);
        ctx.stroke();

        if (camera.k > 0.55 || active) {
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `${12 / camera.k}px "IBM Plex Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.label.slice(0, 28), node.x, node.y - 12 / camera.k);
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
      const factor = ev.deltaY < 0 ? 1.08 : 0.92;
      const next = Math.min(4, Math.max(0.2, camera.k * factor));
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
        setSelected(hit);
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
            Узлы — асаны. Рёбра — sameAs между их фото. Перетаскивание узлов, панорама фона, колесо —
            масштаб. notSameAsObject пока не рисуем.
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
            <p className="asana-graph-side-empty">Кликните по точке на графе</p>
          )}
          <div className="asana-graph-legend">
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
