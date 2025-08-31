import type { Map, GeoJSONSource } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import TimelineController from "./utils/TimelineController";
import { ScrubBar, WelcomeDrawer } from "./components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import MapView, {
  HEATMAP_LAYER_ID,
  CIRCLE_LAYER_ID,
  LOCATIONS_SOURCE_ID,
} from "./components/MapView";
import { useWebSocket } from "./api/hooks/useWebSocket";
import { useSubmitLocation } from "./api/hooks/useSubmitLocation";
import { requestLocationPermission } from "./utils/geolocation";
import type { GeolocationError } from "./utils/geolocation";
import { useLocations } from "./api/hooks/useLocations";
import type { LocationPoint } from "./api/types";

const INITIAL_ZOOM = 13;
const TRAIL_WINDOW_MS = 30 * 60 * 1000; // trailing window (e.g., last 10m)
const PLAY_SPEED = 60 * 1000; // 1 minute of data per real second

export const App = () => {
  const mapRef = useRef<Map | null>(null);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState<number>(0);
  const timeRef = useRef<number>(0);
  const timelineRef = useRef<TimelineController | null>(null);
  const { isConnected, connectionStatus } = useWebSocket();
  const { submitLocation } = useSubmitLocation();
  const { getTimelineLocations } = useLocations();

  const timelineLocations = useMemo(
    () => getTimelineLocations(),
    [getTimelineLocations],
  );

  // Drawer and location sharing state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "success" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const statusColor = isConnected
    ? "text-green-500"
    : connectionStatus.reconnectAttempts > 0
      ? "text-yellow-500"
      : "text-red-500";

  const handleShareLocation = async () => {
    setLocationStatus("requesting");
    setLocationError(null);

    try {
      const position = await requestLocationPermission();
      await submitLocation(position.lat, position.lng, position.accuracy);
      setLocationStatus("success");
      setDrawerOpen(false);
    } catch (error) {
      const geoError = error as GeolocationError;
      setLocationStatus("error");
      setLocationError(geoError.message || "Failed to get location");
    }
  };

  const [minT, maxT] = useMemo(() => {
    if (timelineLocations.length === 0) {
      const now = Date.now();
      return [now - 24 * 60 * 60 * 1000, now]; // Default to 4 hours ago to now when no timeline data
    }

    let min = Infinity,
      max = -Infinity;
    for (const p of timelineLocations as Array<
      Pick<LocationPoint, "timestamp">
    >) {
      const tMs = p.timestamp * 1000;
      if (tMs < min) min = tMs;
      if (tMs > max) max = tMs;
    }
    return [min, max];
  }, [timelineLocations]);

  // Update map data when live locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || timelineLocations.length === 0) return;
    const source = map.getSource(LOCATIONS_SOURCE_ID);
    if (!isGeoJSONSource(source)) return;

    const features = timelineLocations.map((p) => ({
      type: "Feature" as const,
      id: p.id,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))],
      },
      properties: { t: p.timestamp * 1000 },
    }));

    source.setData({ type: "FeatureCollection", features });
  }, [timelineLocations]);

  // Dispose timeline on unmount
  useEffect(() => {
    return () => {
      timelineRef.current?.dispose();
      timelineRef.current = null;
    };
  }, []);

  const handleReset = () => {
    mapRef.current?.flyTo({
      center: origin,
      zoom: INITIAL_ZOOM,
      essential: true,
    });
  };

  const handleScrub = (t: number) => {
    timelineRef.current?.stop();
    setIsPlaying(false);
    timelineRef.current?.setTime(t);
  };

  const handlePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) timelineRef.current?.start();
    else timelineRef.current?.stop();
  };

  return (
    <div>
      <WelcomeDrawer
        drawerOpen={drawerOpen}
        locationError={locationError}
        locationStatus={locationStatus}
        handleShareLocation={handleShareLocation}
      />
      <button
        onClick={handleReset}
        className="h-12 w-12 items-center justify-center rounded-full bg-indigo/30 text-2xl leading-none liquid-glass absolute top-sm left-sm z-10 backdrop-blur-lg rounded-3xl"
      >
        <FontAwesomeIcon
          icon={["fas", "location-arrow"]}
          className="text-black dark:text-white"
        />
      </button>
      <button
        onClick={handleReset}
        className="h-12 w-12 items-center justify-center rounded-full bg-indigo/30 text-lg leading-none liquid-glass absolute top-sm right-sm z-10 backdrop-blur-lg rounded-3xl"
      >
        <FontAwesomeIcon icon={["fas", "circle"]} className={statusColor} />
      </button>
      <ScrubBar
        minT={minT}
        maxT={maxT}
        time={time}
        handleScrub={handleScrub}
        handlePlay={handlePlay}
        isPlaying={isPlaying}
      />
      <MapView
        className="h-dvh w-screen bg-gray-300 z-0 absolute top-0 left-0"
        origin={origin}
        onOriginChange={setOrigin}
        onMapReady={(map) => {
          mapRef.current = map;
          const tl = new TimelineController(map, {
            heatmapLayerId: HEATMAP_LAYER_ID,
            circleLayerId: CIRCLE_LAYER_ID,
            trailWindowMs: TRAIL_WINDOW_MS,
            playSpeed: PLAY_SPEED,
            minTime: minT,
            maxTime: maxT,
            onTimeChange: (t) => {
              setTime(t);
              timeRef.current = t;
            },
          });
          timelineRef.current = tl;
          tl.setTime(minT);
        }}
      />
    </div>
  );
};

// Narrow a Mapbox source to GeoJSONSource by presence of setData
function isGeoJSONSource(s: unknown): s is GeoJSONSource {
  if (typeof s !== "object" || s === null) return false;
  return typeof (s as { setData?: unknown }).setData === "function";
}

// Push live timeline locations to the map's GeoJSON source whenever they change
// Keep this effect outside the component to avoid re-creating the function per render
// but reference component-level refs safely.
