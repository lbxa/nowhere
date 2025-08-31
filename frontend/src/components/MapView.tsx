import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export const HEATMAP_LAYER_ID = "heatmap" as const;
export const CIRCLE_LAYER_ID = "locations-circles" as const;
export const LOCATIONS_SOURCE_ID = "locations" as const;
export const USER_SOURCE_ID = "user-location" as const;
export const USER_PULSE_LAYER_ID = "user-location-pulse" as const;
export const USER_CIRCLE_LAYER_ID = "user-location-circle" as const;
const PULSE_DURATION_MS = 1200;

const getMapStyleFromTheme = (): string =>
  document.documentElement.classList.contains("dark")
    ? "mapbox://styles/mapbox/dark-v11?optimize=true"
    : "mapbox://styles/mapbox/streets-v12?optimize=true";

type MapViewProps = {
  origin: [number, number];
  onOriginChange?: (next: [number, number]) => void;
  onMapReady?: (map: mapboxgl.Map) => void;
  className?: string;
};

// Narrow a Mapbox source to GeoJSONSource by presence of setData
// TODO: Replace with discriminated union once mapbox-gl types expose a safe discriminant
function isGeoJSONSource(s: unknown): s is mapboxgl.GeoJSONSource {
  if (typeof s !== "object" || s === null) return false;
  return typeof (s as { setData?: unknown }).setData === "function";
}

export const MapView = ({
  origin,
  onOriginChange,
  onMapReady,
  className,
}: MapViewProps) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appliedStyleRef = useRef<string>("");
  const originRef = useRef<[number, number]>([0, 0]);
  const pulseAnimationRef = useRef<number | null>(null);
  const pulseStartRef = useRef<number>(0);
  const onOriginChangeRef = useRef<MapViewProps["onOriginChange"]>(undefined);
  const onMapReadyRef = useRef<MapViewProps["onMapReady"]>(undefined);

  onOriginChangeRef.current = onOriginChange;
  onMapReadyRef.current = onMapReady;

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    const initialStyle = getMapStyleFromTheme();
    appliedStyleRef.current = initialStyle;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current!,
      style: initialStyle,
      attributionControl: false,
      renderWorldCopies: false,
      antialias: false,
    });

    // Respond to Tailwind class-based theme changes
    const themeObserver = new MutationObserver(() => {
      const nextStyle = getMapStyleFromTheme();
      if (nextStyle !== appliedStyleRef.current) {
        appliedStyleRef.current = nextStyle;
        mapRef.current?.setStyle(nextStyle);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // User location is requested by the parent App only after user consent

    mapRef.current.on("load", () => {
      try {
        const map = mapRef.current;
        if (!map) return;
        map.addSource(LOCATIONS_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          buffer: 0,
          maxzoom: 12,
        });

        map.addLayer(
          {
            id: HEATMAP_LAYER_ID,
            type: "heatmap",
            source: LOCATIONS_SOURCE_ID,
            minzoom: 0,
            maxzoom: 17,
            paint: {
              "heatmap-weight": 1,
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                0.6,
                17,
                3,
              ],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(236,222,239,0)",
                0.2,
                "rgb(208,209,230)",
                0.4,
                "rgb(166,189,219)",
                0.6,
                "rgb(103,169,207)",
                0.8,
                "rgb(28,144,153)",
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                10,
                11,
                15,
                17,
                25,
              ],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                1,
                16.5,
                0,
              ],
            },
          },
          "waterway-label",
        );

        map.addLayer({
          id: CIRCLE_LAYER_ID,
          type: "circle",
          source: LOCATIONS_SOURCE_ID,
          minzoom: 16,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              16,
              3,
              18,
              6,
              20,
              10,
            ],
            "circle-color": "#93c5fd",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#60a5fa",
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              16,
              0.6,
              18,
              0.85,
            ],
          },
        });

        // User location source and distinct red circle layer + pulse ring
        map.addSource(USER_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: USER_PULSE_LAYER_ID,
          type: "circle",
          source: USER_SOURCE_ID,
          minzoom: 0,
          paint: {
            "circle-radius": 8,
            "circle-color": "#ef4444",
            "circle-opacity": 0.4,
            "circle-blur": 0.6,
          },
        });
        map.addLayer({
          id: USER_CIRCLE_LAYER_ID,
          type: "circle",
          source: USER_SOURCE_ID,
          minzoom: 0,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              4,
              12,
              8,
              18,
              12,
              22,
              16,
            ],
            "circle-color": "#ef4444",
            "circle-opacity": 0.95,
          },
        });
        if (map.getLayer(USER_PULSE_LAYER_ID)) {
          map.moveLayer(USER_PULSE_LAYER_ID);
        }
        if (map.getLayer(USER_CIRCLE_LAYER_ID)) {
          map.moveLayer(USER_CIRCLE_LAYER_ID);
        }

        // Start pulse animation loop
        const startPulse = () => {
          if (pulseAnimationRef.current !== null) return;
          pulseStartRef.current = performance.now();
          const tick = () => {
            const mapLocal = mapRef.current;
            if (!mapLocal) {
              pulseAnimationRef.current = null;
              return;
            }
            const now = performance.now();
            const elapsed = (now - pulseStartRef.current) % PULSE_DURATION_MS;
            const t = elapsed / PULSE_DURATION_MS; // 0..1
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const radius = 8 + eased * 18; // 8 -> 26 px
            const opacity = 0.5 * (1 - t); // fade out
            if (mapLocal.getLayer(USER_PULSE_LAYER_ID)) {
              mapLocal.setPaintProperty(
                USER_PULSE_LAYER_ID,
                "circle-radius",
                radius,
              );
              mapLocal.setPaintProperty(
                USER_PULSE_LAYER_ID,
                "circle-opacity",
                opacity,
              );
            }
            pulseAnimationRef.current = requestAnimationFrame(tick);
          };
          pulseAnimationRef.current = requestAnimationFrame(tick);
        };

        const prefersReduced =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!prefersReduced) startPulse();

        // Notify parent that map and layers are ready
        onMapReadyRef.current?.(map);

        map.on("styledata", () => {
          if (!map.getSource(LOCATIONS_SOURCE_ID)) {
            map.addSource(LOCATIONS_SOURCE_ID, {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
              buffer: 0,
              maxzoom: 12,
            });
          }
          if (!map.getLayer(HEATMAP_LAYER_ID)) {
            map.addLayer(
              {
                id: HEATMAP_LAYER_ID,
                type: "heatmap",
                source: LOCATIONS_SOURCE_ID,
                minzoom: 0,
                maxzoom: 17,
                paint: {
                  "heatmap-weight": 1,
                  "heatmap-intensity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5,
                    0.6,
                    17,
                    3,
                  ],
                  "heatmap-color": [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(236,222,239,0)",
                    0.2,
                    "rgb(208,209,230)",
                    0.4,
                    "rgb(166,189,219)",
                    0.6,
                    "rgb(103,169,207)",
                    0.8,
                    "rgb(28,144,153)",
                  ],
                  "heatmap-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5,
                    10,
                    11,
                    15,
                    17,
                    25,
                  ],
                  "heatmap-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15,
                    1,
                    16.5,
                    0,
                  ],
                },
              },
              "waterway-label",
            );
          }
          if (!map.getLayer(CIRCLE_LAYER_ID)) {
            map.addLayer({
              id: CIRCLE_LAYER_ID,
              type: "circle",
              source: LOCATIONS_SOURCE_ID,
              minzoom: 16,
              paint: {
                "circle-radius": 6,
                "circle-color": "#93c5fd",
                "circle-stroke-width": 1,
                "circle-stroke-color": "#60a5fa",
                "circle-opacity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  16,
                  0.6,
                  18,
                  0.85,
                ],
              },
            });
          }

          if (!map.getSource(USER_SOURCE_ID)) {
            map.addSource(USER_SOURCE_ID, {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            });
          }
          if (!map.getLayer(USER_CIRCLE_LAYER_ID)) {
            map.addLayer({
              id: USER_CIRCLE_LAYER_ID,
              type: "circle",
              source: USER_SOURCE_ID,
              minzoom: 0,
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0,
                  4,
                  12,
                  8,
                  18,
                  12,
                  22,
                  16,
                ],
                "circle-color": "#ef4444",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.95,
              },
            });
          }
          if (!map.getLayer(USER_PULSE_LAYER_ID)) {
            map.addLayer({
              id: USER_PULSE_LAYER_ID,
              type: "circle",
              source: USER_SOURCE_ID,
              minzoom: 0,
              paint: {
                "circle-radius": 8,
                "circle-color": "#ef4444",
                "circle-opacity": 0.4,
                "circle-blur": 0.6,
              },
            });
          }
          if (map.getLayer(USER_PULSE_LAYER_ID)) {
            map.moveLayer(USER_PULSE_LAYER_ID);
          }
          if (map.getLayer(USER_CIRCLE_LAYER_ID)) {
            map.moveLayer(USER_CIRCLE_LAYER_ID);
          }

          // Sync user location data to current origin (from ref)
          const userSrc = map.getSource(USER_SOURCE_ID);
          if (isGeoJSONSource(userSrc)) {
            const coords = originRef.current;
            userSrc.setData({
              type: "FeatureCollection",
              features:
                coords[0] === 0 && coords[1] === 0
                  ? []
                  : [
                      {
                        type: "Feature",
                        geometry: {
                          type: "Point",
                          coordinates: [coords[0], coords[1]],
                        },
                        properties: {},
                      },
                    ],
            });
          }
        });
      } catch (e) {
        console.error("Failed to load locations layer", e);
      }
    });

    // Do not request geolocation here; handled by the parent after consent

    return () => {
      mapRef.current?.remove();
      themeObserver.disconnect();
      if (pulseAnimationRef.current !== null) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
    };
  }, []);

  // Keep user-location source in sync when origin updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(USER_SOURCE_ID);
    if (!isGeoJSONSource(src)) return;
    src.setData({
      type: "FeatureCollection",
      features:
        origin[0] === 0 && origin[1] === 0
          ? []
          : [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [origin[0], origin[1]],
                },
                properties: {},
              },
            ],
    });
    originRef.current = origin;
  }, [origin]);

  return <div className={className} ref={containerRef}></div>;
};

export default MapView;
