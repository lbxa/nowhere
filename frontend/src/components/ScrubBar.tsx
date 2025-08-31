import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const ScrubBar = ({
  minT,
  maxT,
  time,
  handleScrub,
  handlePlay,
  isPlaying,
}: {
  minT: number;
  maxT: number;
  time: number;
  handleScrub: (t: number) => void;
  handlePlay: () => void;
  isPlaying: boolean;
}) => {
  // Normalize slider to 0..1000 to avoid huge epoch ranges causing precision/UX issues
  const sliderMax = 1000;
  const totalRange = Math.max(1, maxT - minT);
  const normalizedValue = Math.min(
    sliderMax,
    Math.max(0, Math.round(((time - minT) / totalRange) * sliderMax)),
  );

  const onChangeNormalized = (value: number) => {
    const ratio = value / sliderMax;
    const newTime = Math.round(minT + ratio * totalRange);
    handleScrub(newTime);
  };

  const datetime =
    new Date(time).toLocaleDateString("en-US", { weekday: "long" }) +
    " " +
    new Date(time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="absolute bottom-sm left-sm right-sm sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 sm:w-full sm:max-w-screen-sm  z-10 liquid-glass rounded-3xl p-md flex flex-col gap-sm">
      <div className="absolute inset-0 rounded-3xl bg-indigo/20 pointer-events-none z-0" />
      <div className="flex items-center gap-sm relative z-10">
        <button
          onClick={handlePlay}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo/40  text-2xl leading-none"
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
        <p className="text-black dark:text-white">{datetime}</p>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          className="appearance-none range-md w-full bg-indigo/30 rounded-lg cursor-pointer accent-indigo relative z-10"
          max={sliderMax}
          step={1}
          value={normalizedValue}
          list="markers"
          onChange={(e) => onChangeNormalized(Number(e.target.value))}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-between px-1"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-lg bg-black dark:bg-white self-center"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
