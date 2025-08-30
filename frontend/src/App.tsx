import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import locations from './mocks/locations.json';

const INITIAL_ZOOM = 13;

export const App = () =>{
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [origin, setOrigin] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
    });

    // Get user's current location and zoom to it
    const getCurrentLocation = () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Fly to user's location with zoom
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: INITIAL_ZOOM,
            essential: true // this animation is considered essential with respect to prefers-reduced-motion
          });
          setOrigin([longitude, latitude]);
        },
        (error) => {
          console.error('Error getting location:', error.message);
          // Could add fallback behavior here, like showing an error message to the user
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Accept cached position up to 5 minutes old
        }
      );
    };

    // Add locations as a blinking light-blue circle layer
    mapRef.current.on('load', () => {
      try {
        const features = (locations as Array<{ id: string; lat: number; lng: number }>).map((p) => ({
          type: 'Feature' as const,
          id: p.id,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: {},
        }));

        mapRef.current?.addSource('locations', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });

        mapRef.current?.addLayer(
          {
            'id': 'heatmap',
            'type': 'heatmap',
            'source': 'locations',
            'maxzoom': 17,
            'paint': {
              // increase weight as diameter breast height increases
              'heatmap-weight': {
                'property': 'dbh',
                'type': 'exponential',
                'stops': [
                  [1, 0],
                  [62, 1]
                ]
              },
              // increase intensity as zoom level increases
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, 1,
                17, 3
              ],
              // use sequential color palette to use exponentially as the weight increases
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(236,222,239,0)',
                0.2,
                'rgb(208,209,230)',
                0.4,
                'rgb(166,189,219)',
                0.6,
                'rgb(103,169,207)',
                0.8,
                'rgb(28,144,153)'
              ],
              // increase radius as zoom increases
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, 15,
                17, 25
              ],
              // decrease opacity to transition into the circle layer
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 1,
                16.5, 0
              ]
            }
          },
          'waterway-label'
        );

        mapRef.current?.addLayer({
          id: 'locations-circles',
          type: 'circle',
          source: 'locations',
          minzoom: 16,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              16, 3,
              18, 6,
              20, 10
            ],
            'circle-color': '#93c5fd',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#60a5fa',
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              16, 0.6,
              18, 0.85
            ]
          },
        });

        // Blink animation: toggle opacity between 0.3 and 1.0
        let animationFrameId = 0;
        const start = performance.now();
        const animate = () => {
          const t = (performance.now() - start) / 1000; // seconds
          const opacity = 0.65 + 0.35 * Math.sin(t * 4); // ~2 Hz blink
          if (mapRef.current && mapRef.current.getLayer('locations-circles')) {
            mapRef.current.setPaintProperty('locations-circles', 'circle-opacity', Math.max(0.3, opacity));
          }
          animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        // Cleanup animation on unmount or style change
        mapRef.current?.on('remove', () => cancelAnimationFrame(animationFrameId));
        mapRef.current?.on('styledata', () => {
          // If style reloads, ensure layer exists again
          if (!mapRef.current?.getSource('locations')) {
            mapRef.current?.addSource('locations', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features },
            });
          }
          if (!mapRef.current?.getLayer('locations-circles')) {
            mapRef.current?.addLayer({
              id: 'locations-circles',
              type: 'circle',
              source: 'locations',
              paint: {
                'circle-radius': 6,
                'circle-color': '#93c5fd',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#60a5fa',
                'circle-opacity': 1,
              },
            });
          }
        });
      } catch (e) {
        console.error('Failed to load locations layer', e);
      }
    });

    // Wait a moment for the map to fully load before getting location
    setTimeout(getCurrentLocation, 1000);

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  const handleReset = () => {
    mapRef.current?.flyTo({
      center: origin,
      zoom: INITIAL_ZOOM,
      essential: true
    });
  }

  return (
    <div>
      <div className="absolute top-0 left-0 bg-blue-200/80 z-10 backdrop-blur-lg rounded-md px-lg">
        <button onClick={handleReset}>Reset</button>
      </div>
      <div className="h-screen w-screen bg-gray-300 z-0 absolute top-0 left-0" ref={mapContainerRef}></div>
    </div>
  )
}