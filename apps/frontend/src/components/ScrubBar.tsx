// ScrubBar.tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/react";

const STEP_MS = 60_000; // 1 minute

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
  const [isScrubbing, setIsScrubbing] = useState(false);
  const clamp = (value: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, value));

  const snapToStep = (t: number) => {
    const snapped = Math.round((t - minT) / STEP_MS) * STEP_MS + minT;
    return clamp(snapped, minT, maxT);
  };

  const percent = useMemo(() => {
    if (maxT === minT) return 0;
    const p = ((time - minT) / (maxT - minT)) * 100;
    return clamp(p, 0, 100);
  }, [time, minT, maxT]);

  const label = useMemo(() => {
    const dt = new Date(time);
    const day = dt.toLocaleDateString("en-AU", {
      weekday: "long",
      timeZone: "Australia/Sydney",
    });
    const tm = dt.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Sydney",
    });
    return `${day} ${tm}`;
  }, [time]);

  // Floating tooltip setup to handle edges
  const { refs, floatingStyles, update } = useFloating({
    open: true,
    placement: "top",
    middleware: [offset(36), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Reposition tooltip when time changes
  useEffect(() => {
    update();
  }, [time, update]);

  const showFloating = isPlaying || isScrubbing;

  return (
    <div className="absolute bottom-sm left-sm right-sm sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 sm:w-full sm:max-w-screen-sm z-10 flex items-stretch gap-sm select-none">
      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={handlePlay}
        className="liquid-glass rounded-full aspect-square h-14 flex-shrink-0 inline-flex items-center justify-center text-xl"
      >
        {isPlaying ? (
          <FontAwesomeIcon
            icon={["fas", "pause"]}
            className="text-black dark:text-white"
          />
        ) : (
          <FontAwesomeIcon
            icon={["fas", "play"]}
            className="text-black dark:text-white"
          />
        )}
      </button>

      <div className="liquid-glass rounded-3xl h-14 px-5 flex items-center flex-1 relative">
        <input
          type="range"
          min={minT}
          max={maxT}
          step={STEP_MS}
          value={time}
          onPointerDown={() => setIsScrubbing(true)}
          onPointerUp={() => setIsScrubbing(false)}
          onBlur={() => setIsScrubbing(false)}
          onChange={(e) => {
            const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
            handleScrub(snapToStep(n));
          }}
          aria-label="Timeline"
          className="appearance-none w-full h-2 rounded-lg bg-black/20 dark:bg-white/20"
        />
        {showFloating && (
          <>
            <div
              ref={refs.setReference}
              aria-hidden="true"
              className="absolute top-1/2 pointer-events-none"
              style={{
                left: `${percent}%`,
                transform: "translateX(-50%) translateY(-50%)",
                width: 1,
                height: 1,
              }}
            />
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="liquid-glass rounded-2xl px-3 py-1 relative z-50 pointer-events-none"
            >
              <span className="text-black dark:text-white text-sm font-medium whitespace-nowrap">
                {label}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
