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
  const datetime =
    new Date(time).toLocaleDateString("en-US", { weekday: "long" }) +
    " " +
    new Date(time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="absolute bottom-sm left-sm right-sm sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 sm:w-full sm:max-w-screen-sm text-ivory z-10 liquid-glass rounded-3xl p-md flex flex-col gap-sm">
      <div className="absolute inset-0 rounded-3xl bg-indigo/20 pointer-events-none z-0" />
      <div className="flex items-center gap-sm relative z-10">
        <button
          onClick={handlePlay}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo/40 text-ivory text-2xl leading-none"
        >
          {isPlaying ? (
            <FontAwesomeIcon icon={["fas", "pause"]} />
          ) : (
            <FontAwesomeIcon icon={["fas", "play"]} />
          )}
        </button>
        <p className="text-ivory/80">{datetime}</p>
      </div>
      <input
        type="range"
        min={minT}
        className="appearance-none range-md w-full bg-indigo/30 rounded-lg cursor-pointer accent-indigo relative z-10"
        max={maxT}
        step={60000}
        value={time}
        onChange={(e) => handleScrub(Number(e.target.value))}
      />
    </div>
  );
};
