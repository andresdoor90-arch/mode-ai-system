/**
 * TryOnMannequin — a flat, minimal 2D paper-doll that wears an outfit.
 *
 * Renders a simple, elegant wooden-mannequin silhouette (head, torso, arms,
 * legs, feet) and paints SIMPLIFIED clothing over the relevant body parts from
 * the {@link GarmentLayer} descriptors — never the photographs. A white shirt
 * with black dots becomes a white torso shape filled with a dotted SVG pattern;
 * blue jeans become blue leg shapes; brown shoes become brown feet shapes.
 *
 * It is pure SVG (no 3D, no WebGL, no canvas), so it is instant and stable, and
 * updates immediately whenever the selected layers change.
 */
import type { GarmentLayer, PatternId } from '../../lib/outfitModel';

const MANNEQUIN = '#41414b';
const MANNEQUIN_DARK = '#33333b';

interface PatternDefProps {
  id: string;
  pattern: PatternId;
  color: string;
  patternColor: string;
}

function PatternDef({ id, pattern, color, patternColor }: PatternDefProps): JSX.Element | null {
  switch (pattern) {
    case 'stripes':
      return (
        <pattern
          id={id}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={10} height={10} fill={color} />
          <rect width={4} height={10} fill={patternColor} />
        </pattern>
      );
    case 'dots':
      return (
        <pattern id={id} width={14} height={14} patternUnits="userSpaceOnUse">
          <rect width={14} height={14} fill={color} />
          <circle cx={7} cy={7} r={2.4} fill={patternColor} />
        </pattern>
      );
    case 'checks':
      return (
        <pattern id={id} width={16} height={16} patternUnits="userSpaceOnUse">
          <rect width={16} height={16} fill={color} />
          <rect x={0} y={0} width={8} height={8} fill={patternColor} opacity={0.55} />
          <rect x={8} y={8} width={8} height={8} fill={patternColor} opacity={0.55} />
        </pattern>
      );
    case 'print':
      return (
        <pattern id={id} width={18} height={18} patternUnits="userSpaceOnUse">
          <rect width={18} height={18} fill={color} />
          <circle cx={5} cy={5} r={1.6} fill={patternColor} opacity={0.5} />
          <circle cx={13} cy={11} r={2} fill={patternColor} opacity={0.4} />
          <circle cx={9} cy={15} r={1.3} fill={patternColor} opacity={0.45} />
        </pattern>
      );
    default:
      return null;
  }
}

const fillFor = (layer: GarmentLayer): string =>
  layer.pattern === 'solid' ? layer.colorHex : `url(#pat-${layer.slot})`;

const STROKE = { stroke: '#00000022', strokeWidth: 1 } as const;

function BottomLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  const fill = fillFor(layer);
  const isShort = /short|bermuda/.test(layer.subcategory);
  const legBottom = isShort ? 250 : 326;
  return (
    <g>
      {/* hips */}
      <rect x={78} y={196} width={64} height={26} rx={6} fill={fill} {...STROKE} />
      {/* legs */}
      <rect x={80} y={214} width={26} height={legBottom - 214} rx={7} fill={fill} {...STROKE} />
      <rect x={114} y={214} width={26} height={legBottom - 214} rx={7} fill={fill} {...STROKE} />
    </g>
  );
}

function FullBodyLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  const fill = fillFor(layer);
  return (
    <g>
      {/* torso */}
      <path d="M76 92 Q110 84 144 92 L150 200 Q110 210 70 200 Z" fill={fill} {...STROKE} />
      {/* short sleeves */}
      <rect x={52} y={92} width={20} height={40} rx={8} fill={fill} {...STROKE} />
      <rect x={148} y={92} width={20} height={40} rx={8} fill={fill} {...STROKE} />
      {/* legs / skirt */}
      <rect x={80} y={200} width={26} height={126} rx={7} fill={fill} {...STROKE} />
      <rect x={114} y={200} width={26} height={126} rx={7} fill={fill} {...STROKE} />
    </g>
  );
}

function TopLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  const fill = fillFor(layer);
  const sleeveBottom = /t-shirt|polo|tank/.test(layer.subcategory) ? 150 : 188;
  return (
    <g>
      {/* torso */}
      <path d="M76 92 Q110 84 144 92 L150 196 Q110 204 70 196 Z" fill={fill} {...STROKE} />
      {/* sleeves */}
      <rect x={52} y={92} width={20} height={sleeveBottom - 92} rx={8} fill={fill} {...STROKE} />
      <rect x={148} y={92} width={20} height={sleeveBottom - 92} rx={8} fill={fill} {...STROKE} />
      {/* collar notch */}
      <path d="M100 86 L110 96 L120 86 Z" fill={MANNEQUIN_DARK} opacity={0.5} />
    </g>
  );
}

function JacketLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  const fill = fillFor(layer);
  return (
    <g>
      {/* full sleeves */}
      <rect x={48} y={90} width={22} height={104} rx={9} fill={fill} {...STROKE} />
      <rect x={150} y={90} width={22} height={104} rx={9} fill={fill} {...STROKE} />
      {/* open front panels (gap in the middle) */}
      <path d="M70 90 Q90 84 104 90 L106 198 Q88 202 72 196 Z" fill={fill} {...STROKE} />
      <path d="M150 90 Q130 84 116 90 L114 198 Q132 202 148 196 Z" fill={fill} {...STROKE} />
      {/* lapels */}
      <path d="M104 90 L110 120 L116 90 Z" fill={MANNEQUIN_DARK} opacity={0.35} />
    </g>
  );
}

function CoatLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  const fill = fillFor(layer);
  return (
    <g>
      {/* long sleeves */}
      <rect x={46} y={90} width={24} height={120} rx={9} fill={fill} {...STROKE} />
      <rect x={150} y={90} width={24} height={120} rx={9} fill={fill} {...STROKE} />
      {/* long front panels reaching the thighs */}
      <path d="M68 90 Q90 82 104 90 L106 270 Q86 276 70 270 Z" fill={fill} {...STROKE} />
      <path d="M152 90 Q130 82 116 90 L114 270 Q134 276 150 270 Z" fill={fill} {...STROKE} />
      <path d="M104 90 L110 126 L116 90 Z" fill={MANNEQUIN_DARK} opacity={0.35} />
    </g>
  );
}

function BeltLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return (
    <g>
      <rect x={74} y={193} width={72} height={9} rx={2} fill={layer.colorHex} {...STROKE} />
      <rect x={104} y={193} width={12} height={9} rx={1} fill={layer.patternColorHex} />
    </g>
  );
}

function ShoesLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return (
    <g>
      <path d="M78 326 L106 326 L110 344 Q94 350 74 344 Z" fill={layer.colorHex} {...STROKE} />
      <path d="M114 326 L142 326 L146 344 Q126 350 110 344 Z" fill={layer.colorHex} {...STROKE} />
    </g>
  );
}

/** Tie at the neck, running down the chest. */
function TieLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return <path d="M110 96 L104 140 L110 152 L116 140 Z" fill={layer.colorHex} {...STROKE} />;
}

/** Wristwatch on the LEFT wrist (bottom of the left-drawn arm). */
function WatchLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return (
    <g>
      <rect x={54} y={181} width={16} height={6} rx={2} fill={MANNEQUIN_DARK} />
      <circle cx={62} cy={184} r={5.5} fill={layer.colorHex} {...STROKE} />
      <circle cx={62} cy={184} r={2} fill={layer.patternColorHex} opacity={0.7} />
    </g>
  );
}

function HatLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return (
    <g>
      <rect x={78} y={28} width={64} height={8} rx={4} fill={layer.colorHex} {...STROKE} />
      <path d="M86 30 Q110 6 134 30 Z" fill={layer.colorHex} {...STROKE} />
    </g>
  );
}

function GlassesLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return (
    <g>
      <circle cx={100} cy={44} r={6} fill="none" stroke={layer.colorHex} strokeWidth={2} />
      <circle cx={120} cy={44} r={6} fill="none" stroke={layer.colorHex} strokeWidth={2} />
      <line x1={106} y1={44} x2={114} y2={44} stroke={layer.colorHex} strokeWidth={2} />
    </g>
  );
}

function ScarfLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return <rect x={92} y={88} width={36} height={12} rx={6} fill={layer.colorHex} {...STROKE} />;
}

function BagLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return <rect x={158} y={150} width={20} height={26} rx={4} fill={layer.colorHex} {...STROKE} />;
}

/** Unknown accessory: a discreet wrist band (never on the torso/abdomen). */
function AccessoryLayer({ layer }: { layer: GarmentLayer }): JSX.Element {
  return <rect x={54} y={182} width={16} height={5} rx={2} fill={layer.colorHex} {...STROKE} />;
}

const SLOT_RENDERERS: Record<
  GarmentLayer['slot'],
  (props: { layer: GarmentLayer }) => JSX.Element
> = {
  fullbody: FullBodyLayer,
  pants: BottomLayer,
  shirt: TopLayer,
  belt: BeltLayer,
  tie: TieLayer,
  jacket: JacketLayer,
  coat: CoatLayer,
  shoes: ShoesLayer,
  watch: WatchLayer,
  scarf: ScarfLayer,
  glasses: GlassesLayer,
  hat: HatLayer,
  bag: BagLayer,
  accessory: AccessoryLayer,
};

export interface TryOnMannequinProps {
  layers: readonly GarmentLayer[];
  className?: string;
}

export function TryOnMannequin({ layers, className }: TryOnMannequinProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 220 380"
      className={className}
      role="img"
      aria-label="Maniquí con el conjunto seleccionado"
    >
      <defs>
        {layers
          .filter((l) => l.pattern !== 'solid')
          .map((l) => (
            <PatternDef
              key={l.slot}
              id={`pat-${l.slot}`}
              pattern={l.pattern}
              color={l.colorHex}
              patternColor={l.patternColorHex}
            />
          ))}
      </defs>

      {/* ------------------------------ mannequin ------------------------------ */}
      <g>
        <circle cx={110} cy={46} r={26} fill={MANNEQUIN} />
        <rect x={101} y={68} width={18} height={16} rx={6} fill={MANNEQUIN_DARK} />
        <path d="M74 90 Q110 80 146 90 L152 198 Q110 208 68 198 Z" fill={MANNEQUIN} />
        <rect x={52} y={90} width={20} height={104} rx={9} fill={MANNEQUIN} />
        <rect x={148} y={90} width={20} height={104} rx={9} fill={MANNEQUIN} />
        <rect x={80} y={196} width={26} height={132} rx={9} fill={MANNEQUIN} />
        <rect x={114} y={196} width={26} height={132} rx={9} fill={MANNEQUIN} />
        <ellipse cx={92} cy={332} rx={16} ry={8} fill={MANNEQUIN_DARK} />
        <ellipse cx={128} cy={332} rx={16} ry={8} fill={MANNEQUIN_DARK} />
        {/* stand */}
        <rect x={106} y={348} width={8} height={20} rx={2} fill={MANNEQUIN_DARK} />
        <ellipse cx={110} cy={370} rx={34} ry={7} fill={MANNEQUIN_DARK} />
      </g>

      {/* ------------------------------ clothing ------------------------------- */}
      {layers.map((layer) => {
        const Renderer = SLOT_RENDERERS[layer.slot];
        return <Renderer key={layer.garmentId} layer={layer} />;
      })}
    </svg>
  );
}
