import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Drawer } from "vaul";

export const WelcomeDrawer = ({
  drawerOpen,
  locationStatus,
  handleShareLocation,
}: {
  drawerOpen: boolean;
  locationStatus: "idle" | "requesting" | "success" | "error";
  handleShareLocation: () => void;
}) => {
  return (
    <Drawer.Root
      open={drawerOpen}
      modal={true}
      dismissible={false}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="h-fit max-w-[410px] mx-auto fixed bottom-0 left-0 right-0 outline-none rounded-t-5xl">
          <div className="p-xl pb-md bg-white/90 backdrop-blur-lg rounded-t-5xl mx-auto">
            <div className="text-center flex flex-col gap-md">
              <div className="space-y-md">
                <h1 className="text-5xl font-black italic text-gray-900 tracking-tight">
                  nowhere
                </h1>
                <p className="text-lg text-gray-600">
                  It's not who you are,
                  <br />
                  just where you are.
                </p>
              </div>

              <div className="space-y-4 py-4">
                <p className="text-gray-700 leading-relaxed">
                  Share your location to see everyone around you in real-time.
                  Never miss out on what's happening again.
                </p>
              </div>

              <div className="space-y-md mt-2xl">
                <button
                  onClick={handleShareLocation}
                  disabled={locationStatus === "requesting"}
                  className="w-full py-4 px-8 text-white font-semibold rounded-2xl bg-gray-900 mesh-gradient ring-1 ring-white/10 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {locationStatus === "requesting" ? (
                    <div className="flex items-center justify-center space-x-3 relative z-10 shadow-xl">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Requesting Location...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-3 relative z-10 shadow-xl">
                      <FontAwesomeIcon icon={["fas", "location-arrow"]} />
                      <span>Share Location</span>
                    </div>
                  )}
                </button>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Your location is used anonymously to display you on the map.
                  We don't request or store your personal information.
                </p>
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
