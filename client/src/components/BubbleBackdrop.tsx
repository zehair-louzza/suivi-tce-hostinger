/**
 * Arrière-plan décoratif ANELEC « Glass Bubbles » :
 * - texture papier (grain SVG) fixe,
 * - grandes bulles colorées floues qui dérivent lentement,
 * - petites bulles de verre brillantes qui montent.
 * Purement décoratif : aria-hidden et pointer-events désactivés.
 */
const BLOBS = ['blob-1', 'blob-2', 'blob-3', 'blob-4', 'blob-5'];

const RISING_BUBBLES: { left: string; size: number; duration: number; delay: number }[] = [
  { left: '6%', size: 26, duration: 22, delay: 0 },
  { left: '14%', size: 14, duration: 17, delay: 6 },
  { left: '23%', size: 38, duration: 28, delay: 3 },
  { left: '35%', size: 18, duration: 19, delay: 11 },
  { left: '47%', size: 30, duration: 25, delay: 8 },
  { left: '58%', size: 12, duration: 16, delay: 2 },
  { left: '66%', size: 44, duration: 31, delay: 14 },
  { left: '74%', size: 20, duration: 20, delay: 5 },
  { left: '83%', size: 32, duration: 26, delay: 10 },
  { left: '92%', size: 16, duration: 18, delay: 1 },
];

export function BubbleBackdrop() {
  return (
    <div className="bubble-backdrop" aria-hidden="true">
      {BLOBS.map((b) => (
        <span key={b} className={`bubble-blob ${b}`} />
      ))}
      {RISING_BUBBLES.map((b, i) => (
        <span
          key={i}
          className="bubble-rise"
          style={{
            left: b.left,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDuration: `${b.duration}s`,
            animationDelay: `-${b.delay}s`,
          }}
        />
      ))}
      <div className="paper-texture" />
    </div>
  );
}
