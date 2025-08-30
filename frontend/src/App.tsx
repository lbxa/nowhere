import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

export const App = () =>{
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
    });

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div className="h-full w-full bg-gray-300" ref={mapContainerRef}>
      <h1>Hello World</h1>
    </div>
  )
}