/**
 * Miniature SVG/CSS interactive des 6 modèles de menu latéral,
 * harmonisée dynamiquement avec la Direction Artistique active (7 styles).
 */
import type { SidebarModelId, ThemeId } from '../stores/themeStore';

interface MiniPalette {
  sbBg: string;
  sbCardBg: string;
  sbBorder: string;
  sbText: string;
  sbMuted: string;
  sbActiveBg: string;
  sbActiveText: string;
  sbSolidBg: string;
  accent: string;
  brandBg: string;
  avatarBg: string;
  pageBg: string;
  radius: string;
  radiusSm: string;
  isDark: boolean;
}

export const THEME_MINI_PALETTES: Record<ThemeId, MiniPalette> = {
  light: {
    sbBg: '#142536',
    sbCardBg: '#1b2f44',
    sbBorder: 'rgba(255,255,255,0.14)',
    sbText: '#cbd5e1',
    sbMuted: 'rgba(255,255,255,0.32)',
    sbActiveBg: '#263d4d',
    sbActiveText: '#ffffff',
    sbSolidBg: '#047857',
    accent: '#00bf63',
    brandBg: '#00bf63',
    avatarBg: '#047857',
    pageBg: '#f6f8fa',
    radius: '6px',
    radiusSm: '3px',
    isDark: true,
  },
  craft: {
    sbBg: '#2a2118',
    sbCardBg: '#362b20',
    sbBorder: 'rgba(255,255,255,0.15)',
    sbText: '#e6dac6',
    sbMuted: 'rgba(255,255,255,0.34)',
    sbActiveBg: '#fbf7ef',
    sbActiveText: '#2a2118',
    sbSolidBg: '#b45309',
    accent: '#f59e0b',
    brandBg: '#b45309',
    avatarBg: '#047857',
    pageBg: '#fbf7ef',
    radius: '9px',
    radiusSm: '5px',
    isDark: true,
  },
  signal: {
    sbBg: '#e8edf2',
    sbCardBg: '#ffffff',
    sbBorder: '#cdd6e0',
    sbText: '#182230',
    sbMuted: '#94a3b8',
    sbActiveBg: '#ffffff',
    sbActiveText: '#047857',
    sbSolidBg: '#047857',
    accent: '#047857',
    brandBg: '#047857',
    avatarBg: '#182230',
    pageBg: '#f6f8fa',
    radius: '3px',
    radiusSm: '2px',
    isDark: false,
  },
  atlas: {
    sbBg: '#ffffff',
    sbCardBg: '#f8fafc',
    sbBorder: '#e2e8f0',
    sbText: '#334155',
    sbMuted: '#cbd5e1',
    sbActiveBg: '#eff6ff',
    sbActiveText: '#1d4ed8',
    sbSolidBg: '#1d4ed8',
    accent: '#1d4ed8',
    brandBg: '#0ea5a4',
    avatarBg: '#1e463a',
    pageBg: '#f6f7fb',
    radius: '6px',
    radiusSm: '3px',
    isDark: false,
  },
  bento: {
    sbBg: '#111827',
    sbCardBg: '#1b2434',
    sbBorder: 'rgba(255,255,255,0.14)',
    sbText: '#e5e7eb',
    sbMuted: 'rgba(255,255,255,0.34)',
    sbActiveBg: '#f5b400',
    sbActiveText: '#111827',
    sbSolidBg: '#f5b400',
    accent: '#f5b400',
    brandBg: '#f5b400',
    avatarBg: '#16a34a',
    pageBg: '#f2f3f5',
    radius: '10px',
    radiusSm: '5px',
    isDark: true,
  },
  swiss: {
    sbBg: '#0b1220',
    sbCardBg: '#131d31',
    sbBorder: '#243047',
    sbText: '#d8d8d4',
    sbMuted: 'rgba(255,255,255,0.34)',
    sbActiveBg: '#1e293b',
    sbActiveText: '#ffffff',
    sbSolidBg: '#e07a5f',
    accent: '#e07a5f',
    brandBg: '#0b3b8f',
    avatarBg: '#e07a5f',
    pageBg: '#ffffff',
    radius: '0px',
    radiusSm: '0px',
    isDark: true,
  },
  dark: {
    sbBg: '#0a1017',
    sbCardBg: '#111a26',
    sbBorder: '#1e2d3d',
    sbText: '#b8c8d7',
    sbMuted: 'rgba(255,255,255,0.28)',
    sbActiveBg: 'rgba(16,185,129,0.22)',
    sbActiveText: '#ffffff',
    sbSolidBg: '#10b981',
    accent: '#00bf63',
    brandBg: '#00bf63',
    avatarBg: '#10b981',
    pageBg: '#0b111a',
    radius: '6px',
    radiusSm: '3px',
    isDark: true,
  },
};

interface SidebarPreviewMiniProps {
  modelId: SidebarModelId;
  themeId: ThemeId;
  width?: number;
  height?: number;
}

export function SidebarPreviewMini({ modelId, themeId, width = 76, height = 64 }: SidebarPreviewMiniProps) {
  const p = THEME_MINI_PALETTES[themeId] || THEME_MINI_PALETTES.atlas;
  const radiusLg = p.radius;
  const radiusSm = p.radiusSm;

  // Frame extérieur figurant le poste + sidebar à gauche
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radiusLg,
        overflow: 'hidden',
        border: `1px solid ${p.sbBorder}`,
        background: p.pageBg,
        display: 'flex',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {modelId === 'classic' && (
        <>
          <div
            style={{
              width: '54%',
              background: p.sbBg,
              borderRight: `1px solid ${p.sbBorder}`,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: radiusSm, background: p.brandBg, display: 'inline-block' }} />
              <span style={{ width: '55%', height: 3, borderRadius: 2, background: p.sbMuted }} />
            </div>
            <span
              style={{
                position: 'absolute',
                right: -4,
                top: 5,
                width: 7,
                height: 7,
                borderRadius: 99,
                background: p.isDark ? p.sbCardBg : '#fff',
                border: `1px solid ${p.sbBorder}`,
              }}
            />
            <span style={{ height: 3, width: '65%', borderRadius: 2, background: p.sbMuted, marginTop: 2 }} />
            <span style={{ height: 6, width: '100%', borderRadius: radiusSm, background: p.sbActiveBg, border: `1px solid ${p.accent}` }} />
            <span style={{ height: 3, width: '75%', borderRadius: 2, background: p.sbMuted }} />
            <span style={{ height: 3, width: '60%', borderRadius: 2, background: p.sbMuted }} />
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: radiusSm, background: p.avatarBg }} />
              <span style={{ height: 3, width: '50%', borderRadius: 2, background: p.sbMuted }} />
            </div>
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 6, width: '70%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, flex: 1 }}>
              <span style={{ borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
              <span style={{ borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
            </div>
          </div>
        </>
      )}

      {modelId === 'line' && (
        <>
          <div
            style={{
              width: '54%',
              background: p.sbBg,
              borderRight: `1px solid ${p.sbBorder}`,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 8, height: 8, borderRadius: radiusSm, background: p.brandBg }} />
              <span style={{ width: 5, height: 5, borderRadius: 2, background: p.sbMuted }} />
            </div>
            <span style={{ height: 3, width: '70%', borderRadius: 2, background: p.sbMuted, marginTop: 2 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: p.isDark ? 'rgba(255,255,255,0.10)' : p.sbActiveBg, borderRadius: `0 ${radiusSm} ${radiusSm} 0`, height: 7, overflow: 'hidden' }}>
              <span style={{ width: 2.5, height: '100%', background: p.accent, display: 'block' }} />
              <span style={{ height: 2.5, width: '58%', background: p.isDark ? '#fff' : p.accent, borderRadius: 1 }} />
            </div>
            <span style={{ height: 3, width: '72%', borderRadius: 2, background: p.sbMuted }} />
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 3px', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' }}>
              <span style={{ width: 3, height: 3, borderRadius: 99, background: '#10b981' }} />
              <span style={{ width: 9, height: 2.5, borderRadius: 1, background: p.accent }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: radiusSm, background: p.avatarBg }} />
              <span style={{ height: 3, width: '50%', borderRadius: 2, background: p.sbMuted }} />
            </div>
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 6, width: '68%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <span style={{ flex: 1, borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
          </div>
        </>
      )}

      {modelId === 'rail' && (
        <>
          <div
            style={{
              width: '19%',
              background: p.isDark ? p.sbBg : '#0f172a',
              padding: '4px 2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: radiusSm, background: p.brandBg }} />
            <span style={{ width: 7, height: 7, borderRadius: radiusSm, background: p.sbSolidBg, marginTop: 2 }} />
            <span style={{ width: 5, height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
            <span style={{ width: 5, height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
            <span style={{ marginTop: 'auto', width: 6, height: 6, borderRadius: 99, background: p.avatarBg }} />
          </div>
          <div
            style={{
              width: '40%',
              background: themeId === 'dark' ? '#111a26' : '#ffffff',
              borderRight: `1px solid ${p.sbBorder}`,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <span style={{ height: 3.5, width: '60%', borderRadius: 2, background: themeId === 'dark' ? 'rgba(255,255,255,0.28)' : '#94a3b8' }} />
            <span style={{ height: 6, width: '100%', borderRadius: radiusSm, background: themeId === 'dark' ? 'rgba(0,191,99,0.2)' : 'rgba(29,78,216,0.12)' }} />
            <span style={{ height: 3, width: '78%', borderRadius: 2, background: themeId === 'dark' ? 'rgba(255,255,255,0.16)' : '#cbd5e1' }} />
            <span style={{ height: 3, width: '66%', borderRadius: 2, background: themeId === 'dark' ? 'rgba(255,255,255,0.16)' : '#cbd5e1' }} />
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 5, width: '80%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <span style={{ flex: 1, borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
          </div>
        </>
      )}

      {modelId === 'cards' && (
        <>
          <div
            style={{
              width: '56%',
              background: p.isDark ? '#0c111c' : '#f1f5f9',
              borderRight: `1px solid ${p.sbBorder}`,
              padding: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 2px' }}>
              <span style={{ width: 6, height: 6, borderRadius: radiusSm, background: p.brandBg }} />
              <span style={{ height: 2.5, width: '48%', borderRadius: 2, background: p.sbMuted }} />
            </div>
            <div style={{ background: p.sbCardBg, border: `1px solid ${p.sbBorder}`, borderRadius: radiusSm, padding: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ height: 5, width: '100%', borderRadius: 2, background: p.sbSolidBg }} />
              <span style={{ height: 2.5, width: '75%', borderRadius: 2, background: p.sbMuted }} />
            </div>
            <div style={{ background: p.sbCardBg, border: `1px solid ${p.sbBorder}`, borderRadius: radiusSm, padding: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ height: 2.5, width: '65%', borderRadius: 2, background: p.sbMuted }} />
            </div>
            <span style={{ marginTop: 'auto', height: 6, width: '100%', borderRadius: radiusSm, background: 'rgba(16,185,129,0.22)', border: '1px solid rgba(16,185,129,0.55)' }} />
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 6, width: '65%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <span style={{ flex: 1, borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
          </div>
        </>
      )}

      {modelId === 'accordion' && (
        <>
          <div
            style={{
              width: '54%',
              background: p.sbBg,
              borderRight: `1px solid ${p.sbBorder}`,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: radiusSm, background: p.brandBg }} />
              <span style={{ height: 2.5, width: '48%', borderRadius: 2, background: p.sbMuted }} />
            </div>
            <span style={{ height: 6, width: '100%', borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.09)' : '#f8fafc', border: `1px solid ${p.sbBorder}` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ height: 2.5, width: '50%', borderRadius: 2, background: p.sbMuted }} />
              <span style={{ fontSize: 6, lineHeight: 1, color: p.sbText }}>▾</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: p.isDark ? 'rgba(255,255,255,0.09)' : p.sbActiveBg, height: 6 }}>
              <span style={{ width: 2, height: '100%', background: p.accent }} />
              <span style={{ height: 2.5, width: '55%', background: p.isDark ? '#fff' : p.accent }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
              <span style={{ height: 2.5, width: '44%', borderRadius: 2, background: p.sbMuted }} />
              <span style={{ fontSize: 6, lineHeight: 1, color: p.sbText }}>▸</span>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: radiusSm, background: p.avatarBg }} />
              <span style={{ height: 2.5, width: '46%', borderRadius: 2, background: p.sbMuted }} />
            </div>
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 6, width: '70%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <span style={{ flex: 1, borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
          </div>
        </>
      )}

      {modelId === 'floating' && (
        <>
          <div style={{ width: '58%', padding: 3, display: 'flex', background: p.pageBg }}>
            <div
              style={{
                flex: 1,
                background: p.sbBg,
                border: `1px solid ${p.sbBorder}`,
                borderRadius: radiusLg,
                padding: 3.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
                boxShadow: '0 2px 6px rgba(15,23,42,0.14)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: radiusSm, background: p.brandBg }} />
              <span style={{ height: 6, width: '100%', borderRadius: radiusSm, background: p.accent }} />
              <span style={{ height: 5, width: '100%', borderRadius: radiusSm, background: p.sbActiveBg }} />
              <span style={{ height: 2.5, width: '70%', borderRadius: 2, background: p.sbMuted }} />
              <div style={{ marginTop: 'auto', border: `1px solid ${p.sbBorder}`, borderRadius: radiusSm, padding: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: radiusSm, background: p.avatarBg }} />
                <span style={{ height: 2.5, width: '50%', borderRadius: 2, background: p.sbMuted }} />
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 6, width: '70%', borderRadius: 2, background: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }} />
            <span style={{ flex: 1, borderRadius: radiusSm, background: p.isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${p.sbBorder}` }} />
          </div>
        </>
      )}
    </div>
  );
}
