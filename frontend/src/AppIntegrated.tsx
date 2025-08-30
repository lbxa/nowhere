

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/trpc";
import TimelineController from "./utils/TimelineController";
import { ScrubBar } from "./components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Import hook directly
import { useLocationApp } from "./api/hooks/useLocationApp";

const INITIAL_ZOOM = 13;
const TRAIL_WINDOW_MS = 10 * 60 * 1000; // trailing window (e.g., last 10m)
const PLAY_SPEED = 60 * 1000; // 1 minute of data per real second

const AppIntegratedInner = () => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState<number>(0);
  const timeRef = useRef<number>(0);
  const timelineRef = useRef<TimelineController | null>(null);

  // Simple location app hook handles everything
  const {
    isLoadingLocations,
    isConnected,
    hasSubmittedLocation,
    isSubmittingLocation,
    locationError,
    permissionDenied,
    retryLocationSubmission,
    getTimelineLocations,
  } = useLocationApp();

  // Convert locations to timeline format and calculate time range
  const timelineLocations = getTimelineLocations();

  const [minT, maxT] = useMemo(() => {
    if (timelineLocations.length === 0) {
      // Default to current time range if no data
      const now = Date.now();
      return [now - 4 * 60 * 60 * 1000, now]; // Last 4 hours
    }

    let min = Infinity,
      max = -Infinity;
    for (const p of timelineLocations) {
      const tMs = p.timestamp * 1000;
      if (tMs < min) min = tMs;
      if (tMs > max) max = tMs;
    }
    return [min, max];
  }, [timelineLocations]);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: "mapbox://styles/mapbox/streets-v12",
      attributionControl: false,
    });

    // Get user's current location and zoom to it
    const getCurrentLocation = () => {
      if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Fly to user's location with zoom
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: INITIAL_ZOOM,
            essential: true,
          });
          setOrigin([longitude, latitude]);
        },
        (error) => {
          console.error("Error getting location:", error.message);
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 600000,
        },
      );
    };

    // Setup map layers with real data
    mapRef.current.on("load", () => {
      try {
        const map = mapRef.current;
        if (!map) return;

        // Initialize with empty data, will be updated when locations load
        map.addSource("locations", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer(
          {
            id: "heatmap",
            type: "heatmap",
            source: "locations",
            maxzoom: 17,
            paint: {
              "heatmap-weight": 1,
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                1,
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
          id: "locations-circles",
          type: "circle",
          source: "locations",
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

        // Initialize timeline controller
        const tl = new TimelineController(map, {
          heatmapLayerId: "heatmap",
          circleLayerId: "locations-circles",
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

        // Blink animation
        let animationFrameId = 0;
        const start = performance.now();
        const animate = () => {
          const t = (performance.now() - start) / 1000;
          const opacity = 0.65 + 0.35 * Math.sin(t * 4);
          if (map && map.getLayer("locations-circles")) {
            map.setPaintProperty(
              "locations-circles",
              "circle-opacity",
              Math.max(0.3, opacity),
            );
          }
          animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        map.on("remove", () => cancelAnimationFrame(animationFrameId));
      } catch (e) {
        console.error("Failed to load locations layer", e);
      }
    });

    setTimeout(getCurrentLocation, 1000);

    return () => {
      timelineRef.current?.dispose();
      timelineRef.current = null;
      mapRef.current?.remove();
    };
  }, []);

  // Update map data when locations change
  useEffect(() => {
    if (!mapRef.current || timelineLocations.length === 0) return;

    const map = mapRef.current;
    const source = map.getSource("locations");

    if (source && source.type === "geojson") {
      const features = timelineLocations.map((p: any) => ({
        type: "Feature" as const,
        id: p.id,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { t: p.timestamp * 1000 },
      }));

      source.setData({ type: "FeatureCollection", features });
    }
  }, [timelineLocations]);

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

  // Simple error handling - show retry button if location failed
  const showLocationError = locationError && !isSubmittingLocation;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Location Error */}
      {showLocationError && (
        <div className="absolute top-sm left-1/2 transform -translate-x-1/2 z-20 bg-red-500/90 backdrop-blur-lg rounded-2xl px-md py-sm text-white text-sm max-w-md text-center">
          <div className="mb-2">{locationError}</div>
          {!permissionDenied && (
            <button
              onClick={retryLocationSubmission}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Success Status */}
      {hasSubmittedLocation && !locationError && (
        <div className="absolute top-sm left-1/2 transform -translate-x-1/2 z-20 bg-green-500/90 backdrop-blur-lg rounded-2xl px-md py-sm text-white text-sm">
          Location shared successfully
        </div>
      )}

      {/* Reset Location Button */}
      <button
        onClick={handleReset}
        className="absolute top-sm left-sm z-20 h-12 w-12 items-center justify-center rounded-full bg-navy/80 backdrop-blur-lg text-ivory text-2xl leading-none liquid-glass"
        title="Return to your location"
      >
        <FontAwesomeIcon icon={["fas", "location-arrow"]} />
      </button>

      {/* Loading Overlay */}
      {(isLoadingLocations || isSubmittingLocation) && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-navy/90 backdrop-blur-lg rounded-3xl p-lg flex items-center gap-md">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo border-t-transparent"></div>
            <span className="text-ivory">
              {isSubmittingLocation ? "Getting your location..." : "Loading locations..."}
            </span>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="absolute top-sm right-sm z-20 bg-red-500/90 backdrop-blur-lg rounded-2xl px-md py-sm text-white text-sm">
          Disconnected - trying to reconnect...
        </div>
      )}

      {/* Scrub Bar */}
      <ScrubBar
        minT={minT}
        maxT={maxT}
        time={time}
        handleScrub={handleScrub}
        handlePlay={handlePlay}
        isPlaying={isPlaying}
      />

      {/* Map Container */}
      <div
        className="h-full w-full bg-gray-300 z-0"
        ref={mapContainerRef}
      />
    </div>
  );
};

export const AppIntegrated = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppIntegratedInner />
    </QueryClientProvider>
  );
};