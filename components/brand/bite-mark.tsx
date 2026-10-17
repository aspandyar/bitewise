import { PWA } from "@/lib/config";

// A plate-like disc with a bite out of its edge, in plain shapes: ImageResponse (Satori) renders
// only a subset of HTML and SVG. Coordinates are in a 100-unit box.
export function BiteMark({ size, scale = 1 }: { size: number; scale?: number }) {
  const mark = size * scale;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PWA.brandColor,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill={PWA.markColor} />
        <circle cx="88" cy="34" r="13" fill={PWA.brandColor} />
        <circle cx="91" cy="55" r="11" fill={PWA.brandColor} />
      </svg>
    </div>
  );
}
