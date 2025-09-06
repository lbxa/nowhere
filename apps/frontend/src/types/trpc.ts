// Manually defined AppRouter type to avoid importing backend router directly
// This prevents version compatibility issues between client and server packages

export interface AppRouter {
  location: {
    getAll: {
      query: () => Promise<{
        locations: Array<{
          userId: string;
          lat: number;
          lng: number;
          timestamp: number;
          ageMinutes: number;
        }>;
        totalActiveUsers: number;
        historicalTimespan: string;
        lastRefresh: number;
      }>;
    };
    submit: {
      mutate: (input: {
        lat: number;
        lng: number;
        accuracy: number;
        timestamp: number;
      }) => Promise<{
        success: boolean;
        userId: string;
        message: string;
      }>;
    };
  };
  health: {
    check: {
      query: () => Promise<{
        status: string;
        timestamp: number;
        uptime: number;
        version: string;
        environment: string;
      }>;
    };
    stats: {
      query: () => Promise<any>;
    };
  };
}