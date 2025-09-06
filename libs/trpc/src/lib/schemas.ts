import { z } from "zod";

// Input schemas
export const LocationInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  timestamp: z
    .number()
    .int()
    .positive()
    .describe("Unix epoch in milliseconds")
    .refine((v) => v >= 1e12, {
      message: "timestamp must be in milliseconds (ms), not seconds",
    }),
});

export const LocationsInputSchema = z.object({
  hours: z.number().int().positive().max(168),
});

// Output schemas
export const LocationOutputSchema = z.object({
  userId: z.string(),
  lat: z.number(),
  lng: z.number(),
  timestamp: z.number(),
  ageMinutes: z.number(),
});

export const LocationsResponseSchema = z.object({
  locations: z.array(LocationOutputSchema),
  totalActiveUsers: z.number(),
  historicalTimespan: z.string(),
  lastRefresh: z.number(),
});

export const StatsResponseSchema = z.object({
  activeUsers: z.number(),
  activeLocations: z.number(),
  totalStoredLocations: z.number(),
  coverage: z.object({
    city: z.string(),
    bounds: z.object({
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    }),
  }),
  dataRetention: z.object({
    displayWindow: z.string(),
    totalDataStored: z.string(),
    oldestEntry: z.number().nullable(),
  }),
  lastUpdate: z.number(),
  uptime: z.number(),
});

export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.number(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
  error: z.string().optional(),
});

export const LocationSubmitResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string(),
  message: z.string(),
});

// Type exports for use in procedures
export type LocationInput = z.infer<typeof LocationInputSchema>;
export type LocationsInput = z.infer<typeof LocationsInputSchema>;
export type LocationOutput = z.infer<typeof LocationOutputSchema>;
export type LocationsResponse = z.infer<typeof LocationsResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type LocationSubmitResponse = z.infer<typeof LocationSubmitResponseSchema>;
