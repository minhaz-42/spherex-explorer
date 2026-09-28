/**
 * Shared SVG definitions for pencil drawings: a wobble filter for hand-drawn lines and hatch
 * patterns in graphite and each band's coloured pencil. Rendered once by the layout; reference them
 * with filter="url(#pencil)" or fill="url(#hatch-band-3)".
 */
export function PencilDefs() {
  const pencils: Array<[string, string]> = [
    ["graphite", "#2a2931"],
    ["accent", "#b93d12"],
    ["highlight", "#e0a800"],
    ["band-1", "#6fa3ea"],
    ["band-2", "#4f8ee2"],
    ["band-3", "#357ad6"],
    ["band-4", "#2463bb"],
    ["band-5", "#1a4f98"],
    ["band-6", "#113e7a"],
  ];
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="pencil-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {pencils.map(([name, color]) => (
          <pattern
            key={name}
            id={`hatch-${name}`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-38)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="1.6" strokeOpacity="0.85" />
          </pattern>
        ))}
        <pattern
          id="crosshatch-graphite"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(40)"
        >
          <path d="M0 0v6M3 0v6" stroke="#2a2931" strokeWidth="0.7" strokeOpacity="0.5" />
          <path d="M0 0h6" stroke="#2a2931" strokeWidth="0.6" strokeOpacity="0.35" />
        </pattern>
      </defs>
    </svg>
  );
}
