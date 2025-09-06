import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface UserSlice {
  // State
  hasLocationPermission: boolean;

  // Actions
  setLocationPermission: (hasPermission: boolean) => void;
  getLocationPermission: () => boolean;
}

// Combined Store State
export type AppState = UserSlice;

// Store Creation with Middleware
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // User Slice
          hasLocationPermission: false,

          setLocationPermission: (hasPermission) =>
            set((state) => {
              state.hasLocationPermission = hasPermission;
            }),

          getLocationPermission: () => {
            return get().hasLocationPermission;
          },
        })),
      ),
      {
        name: "nowhere-app-storage", // LocalStorage key
        partialize: (state) => ({
          // Persist location permission state
          hasLocationPermission: state.hasLocationPermission,
        }),
      },
    ),
    {
      name: "nowhere-app-store", // DevTools name
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
