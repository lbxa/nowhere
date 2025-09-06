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
import { useRequestLocationPermission } from "./utils/geolocation";
import type { GeolocationError } from "./utils/geolocation";
import { useLocations } from "./api/hooks/useLocations";
import type { LocationPoint } from "./api/types";
import toast from "react-hot-toast";
import { deviceIdService } from "./services/deviceIdService";

const INITIAL_ZOOM = 13;
const TRAIL_WINDOW_MS = 30 * 60 * 1000; // trailing window (e.g., last 10m)
const PLAY_SPEED = 60 * 1000; // 1 minute of data per real second

export const App = () => {
  const mapRef = useRef<Map | null>(null);
  const { requestLocationPermission } = useRequestLocationPermission();
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);
  const deviceId = useMemo(() => deviceIdService.getDeviceId(), []);

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
  const statusColor = isConnected
    ? "text-green-500"
    : connectionStatus.reconnectAttempts > 0
      ? "text-yellow-500"
      : "text-red-500";

  const handleShareLocation = async () => {
    setLocationStatus("requesting");

    try {
      const position = await requestLocationPermission();
      // Center map and update origin after user consent
      const center: [number, number] = [position.lng, position.lat];
      setOrigin(center);
      mapRef.current?.flyTo({ center, zoom: INITIAL_ZOOM, essential: true });
      await submitLocation(position.lat, position.lng, position.accuracy);
      setLocationStatus("success");
      setDrawerOpen(false);
    } catch (error) {
      const geoError = error as GeolocationError;
      setLocationStatus("error");
      toast.error(geoError.message || "Failed to get location");
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

  // Ensure the scrub time is always within bounds and initialized
  useEffect(() => {
    setTime((prev) => {
      if (!prev || prev < minT || prev > maxT) return minT;
      return prev;
    });
  }, [minT, maxT]);

  // Update map data when live locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || timelineLocations.length === 0) return;
    const source = map.getSource(LOCATIONS_SOURCE_ID);
    if (!isGeoJSONSource(source)) return;

    const visible = timelineLocations.filter((p) => p.userId !== deviceId);
    const features = visible.map((p) => ({
      type: "Feature" as const,
      id: p.id,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))],
      },
      properties: { t: p.timestamp * 1000 },
    }));

    source.setData({ type: "FeatureCollection", features });
  }, [timelineLocations, deviceId]);

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

  const handleStatusCheck = () =>
    toast(
      connectionStatus.lastConnectionTime
        ? (() => {
            const diffMs = Date.now() - connectionStatus.lastConnectionTime;
            const minutes = Math.round(diffMs / 60000);
            return minutes < 1
              ? `Last ping ${Math.round(diffMs / 1000)} seconds ago`
              : `Last ping ${minutes} minutes ago`;
          })()
        : "No connection time",
    );

  const [isPlaying, setIsPlaying] = useState(false);

  const handleScrub = (t: number) => {
    // Update UI immediately even if timeline isn't ready yet
    setTime(t);
    if (timelineRef.current) {
      timelineRef.current.stop();
      setIsPlaying(false);
      timelineRef.current.setTime(t);
    }
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
        locationStatus={locationStatus}
        handleShareLocation={handleShareLocation}
      />
      <button
        onClick={handleReset}
        className="liquid-glass absolute top-sm left-sm z-10 h-14 w-14 aspect-square rounded-full flex items-center justify-center backdrop-blur-lg cursor-pointer"
        aria-label="Recenter"
      >
        <FontAwesomeIcon
          icon={["fas", "location-arrow"]}
          className="text-black dark:text-white text-xl leading-none"
        />
      </button>
      <button
        onClick={handleStatusCheck}
        className="liquid-glass absolute top-sm right-sm z-10 h-14 w-14 aspect-square rounded-full flex items-center justify-center backdrop-blur-lg"
        aria-label="Connection status"
      >
        <FontAwesomeIcon
          icon={["fas", "circle"]}
          className={`${statusColor} text-xl leading-none`}
        />
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
