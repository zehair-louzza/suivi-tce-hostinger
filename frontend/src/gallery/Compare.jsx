import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import { DIRECTIONS } from '../data/directions';
import { SCREEN_BY_ID, mockUrl } from '../data/screens';
import { BrandLink, DeviceToggle, ScreenPicker, PhoneFrame, ScaledDesktop } from './Chrome';
import { useElementWidth, useFavorite } from './hooks';

const ZOOMS = [
  { id: 's', label: 'Petit', cols: 3, phone: 0.62 },
  { id: 'm', label: 'Moyen', cols: 2, phone: 0.8 },
  { id: 'l', label: 'Grand', cols: 1, phone: 1 },
];

function CompareCell({ d, screen, device, phoneScale, fav, onFav }) {
  const [ref, w] = useElementWidth();
  return (
    <article className="g-cmp-cell" data-testid={`gallery-compare-cell-${d.id}`}>
      <header>
        <span className="g-dir-num" style={{ background: d.swatches[0], color: d.dark ? '#06121F' : '#fff' }}>{d.num}</span>
        <div className="g-cmp-title"><strong>{d.name}</strong><small>{d.tagline}</small></div>
        <button type="button" className={`g-icon-btn ${fav === d.id ? 'is-fav' : ''}`} onClick={() => onFav(d.id)} title="Préférer" data-testid={`gallery-compare-favorite-${d.id}`}><Heart size={15} fill={fav === d.id ? 'currentColor' : 'none'} /></button>
        <Link to={`/viewer?dir=${d.id}&screen=${screen}&device=${device}`} className="g-btn g-btn--sm" data-testid={`gallery-compare-open-${d.id}`}>Ouvrir <ArrowRight size={14} /></Link>
      </header>
      <div className="g-cmp-body" ref={ref}>
        {device === 'desktop' ? (
          <ScaledDesktop src={mockUrl(d.id, screen)} width={w} title={`${d.name}`} />
        ) : (
          <div className="g-cmp-phone"><PhoneFrame src={mockUrl(d.id, screen)} scale={phoneScale} title={d.name} /></div>
        )}
      </div>
    </article>
  );
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const screen = SCREEN_BY_ID[params.get('screen')] ? params.get('screen') : 'tableau-de-bord';
  const device = params.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const [zoom, setZoom] = useState(device === 'mobile' ? 's' : 'm');
  const [fav, toggleFav] = useFavorite();
  const z = ZOOMS.find((x) => x.id === zoom);
  const set = (next) => setParams({ screen, device, ...next });

  return (
    <div className="g-page g-page--compare" data-testid="gallery-compare">
      <header className="g-toolbar">
        <BrandLink />
        <div className="g-toolbar-mid">
          <span className="g-toolbar-title">Comparer les 5 directions</span>
          <ScreenPicker value={screen} onChange={(id) => set({ screen: id })} testid="gallery-compare-screen-switcher" />
        </div>
        <div className="g-toolbar-end">
          <DeviceToggle value={device} onChange={(v) => { set({ device: v }); setZoom(v === 'mobile' ? 's' : 'm'); }} />
          <div className="g-seg" data-testid="gallery-compare-zoom-control">
            {ZOOMS.map((x) => (
              <button key={x.id} type="button" className={`g-seg-btn ${zoom === x.id ? 'is-active' : ''}`} onClick={() => setZoom(x.id)} data-testid={`gallery-compare-zoom-${x.id}`}>{x.label}</button>
            ))}
          </div>
        </div>
      </header>
      <div
        className={`g-cmp-grid ${device === 'mobile' ? 'is-mobile' : ''}`}
        style={device === 'desktop' ? { gridTemplateColumns: `repeat(${z.cols}, minmax(0, 1fr))` } : undefined}
      >
        {DIRECTIONS.map((d) => (
          <CompareCell key={`${d.id}-${screen}-${device}`} d={d} screen={screen} device={device} phoneScale={z.phone} fav={fav} onFav={toggleFav} />
        ))}
      </div>
    </div>
  );
}
