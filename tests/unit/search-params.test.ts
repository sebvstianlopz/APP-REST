import { describe, expect, it } from "vitest";
import { parseDishes, parseSearchParams, toSearchString } from "@/lib/search-params";

describe("parseDishes", () => {
  it("splits, trims and de-duplicates ignoring case and accents", () => {
    expect(parseDishes(" mofongo , Alcapurrias,, MOFONGO , alcapurrías ")).toEqual(["mofongo", "Alcapurrias"]);
  });
  it("caps the number and length of dishes", () => {
    expect(parseDishes(Array.from({ length: 20 }, (_, i) => `plato ${i}`).join(","))).toHaveLength(10);
    expect(parseDishes("x".repeat(200))[0]).toHaveLength(60);
  });
  it("handles empty input", () => {
    expect(parseDishes(undefined)).toEqual([]);
    expect(parseDishes(" , ")).toEqual([]);
  });
});

describe("parseSearchParams", () => {
  it("parses a municipality search", () => {
    expect(parseSearchParams({ platos: "mofongo,tostones", municipio: "caguas" })).toEqual({
      dishes: ["mofongo", "tostones"],
      municipio: "caguas",
    });
  });
  it("prefers coordinates over municipality/region and defaults the radius", () => {
    expect(parseSearchParams({ platos: "flan", lat: "18.4661234", lng: "-66.1057", municipio: "ponce" })).toEqual({
      dishes: ["flan"],
      lat: 18.4661,
      lng: -66.1057,
      radio: 25,
    });
  });
  it("rejects coordinates outside Puerto Rico and junk values", () => {
    expect(parseSearchParams({ platos: "flan", lat: "40.7", lng: "-74" })).toEqual({ dishes: ["flan"] });
    expect(parseSearchParams({ platos: "flan", municipio: "../etc", region: "mars" })).toEqual({ dishes: ["flan"] });
  });
  it("accepts a region", () => {
    expect(parseSearchParams({ platos: "flan", region: "oeste" })).toEqual({ dishes: ["flan"], region: "oeste" });
  });
  it("round-trips through toSearchString", () => {
    const q = { dishes: ["mofongo", "arroz con gandules"], lat: 18.2, lng: -66.5, radio: 10 };
    const back = parseSearchParams(Object.fromEntries(new URLSearchParams(toSearchString(q))));
    expect(back).toEqual(q);
  });
});
