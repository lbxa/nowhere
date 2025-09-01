class DeviceIdService {
  private static instance: DeviceIdService;
  private deviceId: string | null = null;
  private readonly STORAGE_KEY = "nowhere_device_id";

  private constructor() {}

  static getInstance(): DeviceIdService {
    if (!DeviceIdService.instance) {
      DeviceIdService.instance = new DeviceIdService();
    }
    return DeviceIdService.instance;
  }

  /**
   * Validate a UUID (v4)
   */
  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  /**
   * Generate an RFC4122 UUID v4
   */
  private generateUuidV4(): string {
    // Prefer Web Crypto API when available
    try {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        return crypto.randomUUID();
      }
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        // Per RFC 4122 section 4.4
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
        const toHex = (n: number) => n.toString(16).padStart(2, "0");
        return (
          `${toHex(bytes[0])}${toHex(bytes[1])}${toHex(bytes[2])}${toHex(bytes[3])}-` +
          `${toHex(bytes[4])}${toHex(bytes[5])}-` +
          `${toHex(bytes[6])}${toHex(bytes[7])}-` +
          `${toHex(bytes[8])}${toHex(bytes[9])}-` +
          `${toHex(bytes[10])}${toHex(bytes[11])}${toHex(bytes[12])}${toHex(bytes[13])}${toHex(bytes[14])}${toHex(bytes[15])}`
        );
      }
    } catch {
      // fall through to Math.random-based fallback
    }
    // Fallback (not cryptographically strong, but conforms to UUID v4 format)
    const fallback = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
    return fallback;
  }

  /**
   * Get or create device ID
   */
  getDeviceId(): string {
    if (!this.deviceId) {
      // Try to load from localStorage first
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored && this.isValidUuid(stored)) {
          this.deviceId = stored;
        } else {
          // Generate new UUID v4 and persist
          const id = this.generateUuidV4();
          this.deviceId = id;
          localStorage.setItem(this.STORAGE_KEY, id);
        }
      } catch (error) {
        // Fallback if localStorage is not available
        console.warn(
          "localStorage not available, using session-only device ID:",
          error,
        );
        this.deviceId = this.generateUuidV4();
      }
    }

    return this.deviceId;
  }

  /**
   * Reset device ID (useful for testing or privacy reset)
   */
  resetDeviceId(): string {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn("Could not clear device ID from localStorage:", error);
    }

    const id = this.generateUuidV4();
    this.deviceId = id;
    try {
      localStorage.setItem(this.STORAGE_KEY, id);
    } catch (error) {
      console.warn("Could not clear device ID from localStorage:", error);
    }
    return id;
  }

  /**
   * Check if device ID is persistent (stored in localStorage)
   */
  isPersistent(): boolean {
    try {
      return !!localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const deviceIdService = DeviceIdService.getInstance();
export default deviceIdService;
