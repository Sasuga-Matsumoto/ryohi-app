import { describe, expect, it } from "vitest";
import { haversineKm, haversineMeters } from "./geo";

describe("haversine", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(35.681, 139.766, 35.681, 139.766)).toBe(0);
  });

  it("computes Tokyo to Osaka roughly 400km", () => {
    // 東京駅 35.681,139.767 → 大阪駅 34.702,135.495
    const km = haversineKm(35.681, 139.767, 34.702, 135.495);
    expect(km).toBeGreaterThan(390);
    expect(km).toBeLessThan(410);
  });

  it("haversineMeters returns km * 1000", () => {
    const km = haversineKm(35.681, 139.767, 35.690, 139.700);
    const m = haversineMeters(35.681, 139.767, 35.690, 139.700);
    expect(m).toBeCloseTo(km * 1000, 2);
  });

  it("computes ~6.5km between Shibuya and Shinjuku", () => {
    // 渋谷 35.658,139.701 → 新宿 35.690,139.700
    const km = haversineKm(35.658, 139.701, 35.690, 139.700);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(5);
  });
});
