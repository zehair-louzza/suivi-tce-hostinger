import { useEffect, useRef, useState, useCallback } from 'react';

export function useElementWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const FAV_KEY = 'anelec-maquette-favori';
export function useFavorite() {
  const [fav, setFav] = useState(() => {
    try { return localStorage.getItem(FAV_KEY) || null; } catch { return null; }
  });
  const toggle = useCallback((id) => {
    setFav((cur) => {
      const next = cur === id ? null : id;
      try {
        if (next) localStorage.setItem(FAV_KEY, next); else localStorage.removeItem(FAV_KEY);
      } catch { /* stockage indisponible */ }
      return next;
    });
  }, []);
  return [fav, toggle];
}

export function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return ref;
}
