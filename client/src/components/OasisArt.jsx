
// Brand mark and dusk-oasis illustration.
// Both are SVG, so no external image files are required.

export function Mark({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="#0f3539" />
      <path d="M7 19 A9 9 0 0 1 25 19 Z" fill="#ffb23e" />
      <path
        d="M5 22.4c3-2 5-2 8 0s5 2 8 0 5-2 6 0"
        stroke="#4fdcd2"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M8 27c3-1.6 5-1.6 8 0s5 1.6 8 0"
        stroke="#4fdcd2"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

function Palm({ x, y, height, lean = 14, scale = 1 }) {
  const top = { x: x + lean, y: y - height };
  const leaf = "M0 0 C 22 -24, 60 -24, 92 8 C 60 -6, 26 -4, 0 0Z";
  const angles = [-165, -128, -92, -56, -20, 16, 52];

  return (
    <g>
      <path
        d={`M${x} ${y} Q ${x + lean * 0.2} ${y - height * 0.55} ${top.x} ${top.y}`}
        stroke="#06191b"
        strokeWidth={9 * scale}
        fill="none"
        strokeLinecap="round"
      />
      <g
        transform={`translate(${top.x} ${top.y}) scale(${scale})`}
        fill="#06191b"
      >
        {angles.map((angle) => (
          <path
            key={angle}
            d={leaf}
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </g>
  );
}

const STARS = [
  [80, 40], [170, 96], [260, 30], [340, 70],
  [430, 26], [520, 88], [600, 48], [690, 22],
  [770, 70], [930, 34], [1010, 80], [1100, 28],
  [1160, 90], [40, 120], [380, 130],
];

export function HeroScene({ id = "scene", view = "0 0 1200 460" }) {
  return (
    <svg
      className="hero-scene"
      viewBox={view}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-sky`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stopColor="#0a2629" />
          <stop offset=".48" stopColor="#12404a" />
          <stop offset=".74" stopColor="#2c6663" />
          <stop offset=".9" stopColor="#d9955a" />
          <stop offset="1" stopColor="#f2bf78" />
        </linearGradient>

        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffd98a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect
        width="1200"
        height="460"
        fill={`url(#${id}-sky)`}
      />

      {STARS.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={x % 3 === 0 ? 1.8 : 1.2}
          fill="#f4e8cb"
          opacity=".7"
        />
      ))}

      <circle
        cx="880"
        cy="338"
        r="200"
        fill={`url(#${id}-glow)`}
      />
      <circle cx="880" cy="338" r="66" fill="#ffd98a" />

      <path
        d="M0 352 C150 322 280 346 420 336 S700 302 860 340 S1100 324 1200 342 L1200 460 L0 460Z"
        fill="#1d5958"
      />

      <ellipse
        cx="880"
        cy="376"
        rx="236"
        ry="21"
        fill="#4fdcd2"
        opacity=".55"
      />
      <ellipse
        cx="880"
        cy="376"
        rx="70"
        ry="6"
        fill="#ffd98a"
        opacity=".7"
      />

      <path
        d="M760 372h44M930 380h58M840 384h36"
        stroke="#f4e8cb"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".35"
      />

      <path
        d="M0 404 C200 376 420 396 620 388 S1000 400 1200 384 L1200 460 L0 460Z"
        fill="#14464a"
      />

      <Palm x={1018} y={398} height={150} lean={22} />
      <Palm x={1092} y={400} height={104} lean={-10} scale={0.8} />
      <Palm x={706} y={396} height={118} lean={-16} scale={0.9} />

      <path
        d="M0 432 C260 410 520 442 800 426 S1100 412 1200 430 L1200 460 L0 460Z"
        fill="#0b2a2d"
      />
    </svg>
  );
}
