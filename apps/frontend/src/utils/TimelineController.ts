import type { Map, Expression } from "mapbox-gl";
import { createPingOpacityDecay } from "./mapboxPingOpacityDecay";

export type TimelineControllerOptions = {
  heatmapLayerId: string;
  circleLayerId: string;
  trailWindowMs: number;
  playSpeed: number; // data milliseconds advanced per real second
  minTime: number;
  maxTime: number;
  onTimeChange?: (t: number) => void;
  // Limit how often map styling is updated to reduce layer update cost
  // Defaults to 10 updates per second
  updatesPerSecond?: number;
};

export default class TimelineController {
  private readonly map: Map;
  private readonly heatmapLayerId: string;
  private readonly circleLayerId: string;
  private readonly trailWindowMs: number;
  private readonly playSpeed: number;
  private readonly minTime: number;
  private readonly maxTime: number;
  private onTimeChange?: (t: number) => void;
  private updateIntervalMs: number;
  private lastAppliedAtMs: number = 0;

  private currentTime: number;
  private animId: number | null = null;
  private styleHandler: (() => void) | null = null;
  private removeHandler: (() => void) | null = null;

  constructor(map: Map, options: TimelineControllerOptions) {
    this.map = map;
    this.heatmapLayerId = options.heatmapLayerId;
    this.circleLayerId = options.circleLayerId;
    this.trailWindowMs = options.trailWindowMs;
    this.playSpeed = options.playSpeed;
    this.minTime = options.minTime;
    this.maxTime = options.maxTime;
    this.onTimeChange = options.onTimeChange;
    this.updateIntervalMs = 1000 / (options.updatesPerSecond ?? 10);

    this.currentTime = this.minTime;

    // Re-apply state when style reloads; stop animation when map is removed
    this.styleHandler = () => {
      this.applyTimeToMap(this.currentTime);
    };
    this.removeHandler = () => {
      this.stop();
    };
    this.map.on("styledata", this.styleHandler);
    this.map.on("remove", this.removeHandler);
  }

  public setTime(t: number): void {
    this.currentTime = t;
    this.applyTimeToMap(t);
  }

  public start(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      let next = this.currentTime + (dt * this.playSpeed) / 1000;
      if (next > this.maxTime) next = this.maxTime;
      this.setTime(next);
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  public stop(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
  }

  public dispose(): void {
    this.stop();
    if (this.styleHandler) this.map.off("styledata", this.styleHandler);
    if (this.removeHandler) this.map.off("remove", this.removeHandler);
    this.styleHandler = null;
    this.removeHandler = null;
  }

  private applyTimeToMap(t: number): void {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - this.lastAppliedAtMs < this.updateIntervalMs) return;
    this.lastAppliedAtMs = now;

    const filter: Expression = [
      "all",
      ["has", "t"],
      [">=", ["get", "t"], t - this.trailWindowMs],
      ["<=", ["get", "t"], t],
    ];

    if (this.map.getLayer(this.heatmapLayerId)) {
      this.map.setFilter(this.heatmapLayerId, filter);
      const weight: Expression = [
        "interpolate",
        ["linear"],
        ["-", t, ["get", "t"]],
        0,
        1,
        this.trailWindowMs,
        0,
      ];
      this.map.setPaintProperty(this.heatmapLayerId, "heatmap-weight", weight);
    }
    if (this.map.getLayer(this.circleLayerId)) {
      this.map.setFilter(this.circleLayerId, filter);
      const opacityExpression = createPingOpacityDecay(t, {
        maxOpacity: 0.85,
        minOpacity: 0.1,
        maxDecayTimeMs: this.trailWindowMs,
      });
      this.map.setPaintProperty(
        this.circleLayerId,
        "circle-opacity",
        opacityExpression as Expression,
      );
    }

    // Notify after a map update was actually applied (throttled)
    if (this.onTimeChange) this.onTimeChange(t);
  }
}
