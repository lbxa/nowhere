// ScrubBar.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/react";

const STEP_MS = 60_000; // 1 minute
const LONG_PRESS_MS = 20; // hold duration to start scrubbing
const MOVE_TOLERANCE_PX = 6; // cancel long-press if moved too much pre-hold

type Props = {
  minT: number;
  maxT: number;
  time: number;
  handleScrub: (t: number) => void;
  handlePlay: () => void;
  isPlaying: boolean;
};

export const ScrubBar = ({
  minT,
  maxT,
  time,
  handleScrub,
  handlePlay,
  isPlaying,
}: Props) => {
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Long-press state
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const isPressingRef = useRef(false);

  // Tooltip visibility (keep visible while playing or dragging)
  const tooltipVisible = isDragging || isPlaying;

  // Tooltip
  const { refs, floatingStyles, update } = useFloating({
    open: tooltipVisible,
    placement: "top",
    middleware: [offset(20), flip(), shift({ padding: 8 })],
    whileElementsMounted: (reference, floating, u) =>
      autoUpdate(reference, floating, u, { animationFrame: true }),
  });

  // Keep tooltip in lockstep with playhead changes
  useEffect(() => {
    if (isPlaying) update();
  }, [time, isPlaying, update]);

  // Format day + time (thumb center => `time`)
  const dt = new Date(time);
  const datetime =
    dt.toLocaleDateString("en-AU", {
      weekday: "long",
      timeZone: "Australia/Sydney",
    }) +
    " " +
    dt.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Sydney",
    });

  // px <-> time helpers
  const getTrackMetrics = () => {
    const rect = trackRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, left: rect?.left ?? 0 };
  };
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const pxToTime = (x: number) => {
    const { width } = getTrackMetrics();
    if (width <= 0) return minT;
    const pct = clamp(x, 0, width) / width;
    const raw = minT + pct * (maxT - minT);
    const snapped = Math.round((raw - minT) / STEP_MS) * STEP_MS + minT;
    return clamp(snapped, minT, maxT);
  };
  const timeToPx = (t: number) => {
    const { width } = getTrackMetrics();
    if (width <= 0 || maxT === minT) return 0;
    return clamp(((t - minT) / (maxT - minT)) * width, 0, width);
  };

  // Place overlay thumb at true center whenever time/size changes
  useEffect(() => {
    const place = () => {
      if (!thumbRef.current || !trackRef.current) return;
      // X position from time
      thumbRef.current.style.left = `${timeToPx(time)}px`;
      // TRUE vertical center based on the track container’s height
      const centerY = trackRef.current.clientHeight / 2;
      thumbRef.current.style.top = `${centerY}px`;
      thumbRef.current.style.transform = "translateX(-50%) translateY(-50%)";
    };

    place();
    const ro = new ResizeObserver(place);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [time, minT, maxT]);

  // Global pointer listeners — ONLY drag after long-press
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // If we're still waiting for the hold, cancel if moved too far
      if (isPressingRef.current && !isDragging && pressOriginRef.current) {
        const dx = e.clientX - pressOriginRef.current.x;
        const dy = e.clientY - pressOriginRef.current.y;
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          isPressingRef.current = false;
          return;
        }
      }
      // While dragging, compute time from thumb center
      if (isDragging) {
        const { left } = getTrackMetrics();
        const centerX = e.clientX - left;
        handleScrub(pxToTime(centerX));
      }
    };

    const endAll = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      isPressingRef.current = false;
      setIsDragging(false);
    };

    if (isPressingRef.current || isDragging) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endAll, { once: true });
      window.addEventListener("pointercancel", endAll, { once: true });
      window.addEventListener("blur", endAll, { once: true });
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endAll);
      window.removeEventListener("pointercancel", endAll);
      window.removeEventListener("blur", endAll);
    };
  }, [isDragging, minT, maxT, handleScrub]);

  const startHold = (clientX: number, clientY: number) => {
    isPressingRef.current = true;
    pressOriginRef.current = { x: clientX, y: clientY };
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      if (isPressingRef.current) {
        // Stop playing when user starts scrubbing
        if (isPlaying) handlePlay(); // toggle off
        setIsDragging(true); // begin scrubbing only after long-press completes
      }
    }, LONG_PRESS_MS);
  };

  return (
    <div className="absolute bottom-sm left-sm right-sm sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 sm:w-full sm:max-w-screen-sm z-10 flex items-stretch gap-sm select-none">
      {/* Play/Pause */}
      <div className="liquid-glass glass-tint rounded-full aspect-square h-14 flex-shrink-0 relative flex items-center justify-center">
        <button
          onClick={handlePlay}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo/40 text-xl leading-none transition-all hover:bg-indigo/50"
        >
          {isPlaying ? (
            <FontAwesomeIcon
              icon={["fas", "pause"]}
              className="text-black dark:text-white"
            />
          ) : (
            <FontAwesomeIcon
              icon={["fas", "play"]}
              className="text-black dark:text-white ml-0.5"
            />
          )}
        </button>
      </div>

      {/* Scrubber */}
      <div className="liquid-glass glass-tint rounded-3xl h-14 px-5 flex items-center flex-1 relative overflow-visible">
        <div className="relative z-10 w-full" ref={trackRef}>
          {/* Visual track (native input) — thumb hidden and NON-interactive */}
          <input
            ref={inputRef}
            type="range"
            min={minT}
            max={maxT}
            step={STEP_MS}
            value={time}
            readOnly
            aria-hidden="true"
            className="appearance-none w-full h-2 bg-indigo/30 rounded-lg relative z-10 pointer-events-none
              [&::-webkit-slider-thumb]:opacity-0 [&::-moz-range-thumb]:opacity-0 [&::-ms-thumb]:opacity-0
              [&::-webkit-slider-thumb]:w-0 [&::-moz-range-thumb]:w-0 [&::-ms-thumb]:w-0"
          />

          {/* Tick marks */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex justify-between"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-black/60 dark:bg-white/60"
              />
            ))}
          </div>

          {/* Overlay thumb (true center): long-press to start, then drag */}
          <div
            ref={(el) => {
              thumbRef.current = el!;
              if (el) refs.setReference(el); // tooltip follows thumb center
            }}
            className="glass-thumb absolute z-40 h-6 w-6 rounded-full touch-none cursor-pointer"
            style={{
              left: 0,
              top: "50%",
              transform: "translateX(-50%) translateY(-50%)",
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              startHold(e.clientX, e.clientY);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Tooltip — identical glass stack to scrubber */}
          <div
            ref={refs.setFloating}
            className={`
              liquid-glass glass-tint rounded-2xl px-4 py-2 relative z-50
              transition-all duration-200 ease-out origin-bottom
              ${tooltipVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-1"}
              pointer-events-none
            `}
            style={floatingStyles}
          >
            <p
              className="relative z-10 text-black dark:text-white text-sm font-medium whitespace-nowrap"
              style={{ textShadow: "0 1px 1px rgba(0,0,0,.35)" }}
            >
              {datetime}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
