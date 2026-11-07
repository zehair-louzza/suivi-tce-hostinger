import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TILES } from '../data/directions';

// Carte Leaflet stylisée selon la direction (tuiles CARTO)
export function MapView({ tiles = 'positron', center = [48.8775, 2.3050], zoom = 12, markers = [], routes = [], hq, height = '100%', testid, fitKey, interactive = true }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current, { zoomControl: interactive, attributionControl: true, scrollWheelZoom: false, dragging: interactive }).setView(center, zoom);
    L.tileLayer(TILES[tiles] || TILES.positron, { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const t = setTimeout(() => map.current && map.current.invalidateSize(), 200);
    return () => { clearTimeout(t); map.current && map.current.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds = [];
    routes.forEach((r) => {
      if (r.points.length < 2) return;
      L.polyline(r.points, { color: r.color, weight: 4, opacity: 0.9, dashArray: r.dashed ? '6 8' : null, lineJoin: 'round' }).addTo(layer.current);
      r.points.forEach((p) => bounds.push(p));
    });
    markers.forEach((m) => {
      const html = m.type === 'tech'
        ? `<div class="m-mk m-mk--tech" style="--c:${m.color}"><span>${m.label}</span></div>`
        : `<div class="m-mk m-mk--stop" style="--c:${m.color}"><span>${m.label}</span></div>`;
      const icon = L.divIcon({ html, className: 'm-mk-wrap', iconSize: m.type === 'tech' ? [34, 34] : [26, 26], iconAnchor: m.type === 'tech' ? [17, 17] : [13, 13] });
      const mk = L.marker(m.pos, { icon }).addTo(layer.current);
      if (m.popup) mk.bindTooltip(m.popup, { direction: 'top', offset: [0, -14], className: 'm-map-tip' });
      bounds.push(m.pos);
    });
    if (hq) {
      const icon = L.divIcon({ html: '<div class="m-mk m-mk--hq"><span>QG</span></div>', className: 'm-mk-wrap', iconSize: [36, 36], iconAnchor: [18, 18] });
      L.marker(hq.pos, { icon }).addTo(layer.current).bindTooltip(`${hq.name} — ${hq.addr}`, { direction: 'top', className: 'm-map-tip' });
      bounds.push(hq.pos);
    }
    if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, JSON.stringify(markers.map((m) => m.label + m.pos)), JSON.stringify(routes.map((r) => r.points.length + r.color))]);

  useEffect(() => {
    const t = setTimeout(() => map.current && map.current.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [height, fitKey]);

  return <div ref={el} className="m-map" style={{ height }} data-testid={testid} />;
}
