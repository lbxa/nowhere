export interface OpacityDecayOptions {
  maxOpacity?: number;
  minOpacity?: number;
  maxDecayTimeMs?: number;
}

export function createPingOpacityDecay(
  referenceTime: number,
  options: OpacityDecayOptions = {},
) {
  const {
    maxOpacity = 0.85,
    minOpacity = 0.1,
    maxDecayTimeMs = 30 * 60 * 1000, // 30 minutes
  } = options;

  // Simple time-based linear decay
  return [
    "interpolate",
    ["linear"],
    ["-", referenceTime, ["get", "t"]],
    0,
    maxOpacity,
    maxDecayTimeMs,
    minOpacity,
  ];
}

export function createZoomBasedOpacity() {
  return ["interpolate", ["linear"], ["zoom"], 16, 0.6, 18, 0.85];
}
