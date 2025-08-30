import type { Map } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import TimelineController from "./utils/TimelineController";
import locations from "./mocks/locations-max.json";
import { ScrubBar } from "./components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import MapView, {
  HEATMAP_LAYER_ID,
  CIRCLE_LAYER_ID,
} from "./components/MapView";

const INITIAL_ZOOM = 13;
const TRAIL_WINDOW_MS = 30 * 60 * 1000; // trailing window (e.g., last 10m)
const PLAY_SPEED = 60 * 1000; // 1 minute of data per real second
//

export const App = () => {
  const mapRef = useRef<Map | null>(null);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState<number>(0);
  const timeRef = useRef<number>(0);
  const timelineRef = useRef<TimelineController | null>(null);

  const [minT, maxT] = useMemo(() => {
    let min = Infinity,
      max = -Infinity;
    for (const p of locations as Array<{ timestamp: number }>) {
      const tMs = p.timestamp * 1000;
      if (tMs < min) min = tMs;
      if (tMs > max) max = tMs;
    }
    return [min, max];
  }, []);

  // Dispose timeline on unmount
  useEffect(() => {
    return () => {
      timelineRef.current?.dispose();
      timelineRef.current = null;
    };
  }, []);

  // origin sync handled inside MapView

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
      <button
        onClick={handleReset}
        className="h-12 w-12 items-center justify-center rounded-full bg-indigo/30 text-2xl leading-none liquid-glass absolute top-sm left-sm z-10 backdrop-blur-lg rounded-3xl"
      >
        <FontAwesomeIcon
          icon={["fas", "location-arrow"]}
          className="text-black dark:text-white"
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
