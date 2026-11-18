import { describe, expect, it } from "vitest";
import { parseCsv, parseMenuCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and empty lines", () => {
    const csv = 'a,"b, with comma","say ""hi"""\r\n\r\nc,d,e\n';
    expect(parseCsv(csv)).toEqual([
      ["a", "b, with comma", 'say "hi"'],
      ["c", "d", "e"],
    ]);
  });
  it("detects semicolon-delimited files (Excel in Spanish locales)", () => {
    expect(parseCsv("nombre;precio\nFlan;4,50")).toEqual([
      ["nombre", "precio"],
      ["Flan", "4,50"],
    ]);
  });
});

describe("parseMenuCsv", () => {
  it("skips the header and maps columns", () => {
    const rows = parseMenuCsv(
      "nombre,descripcion,precio,categoria\n" +
        'Mofongo de pollo,"Con caldo, ajo",$14.95,Platos\n' +
        "Tembleque,,3.5,Postres\n" +
        ",sin nombre,1,X\n" +
        "Agua,,gratis,\n",
    );
    expect(rows).toEqual([
      { name: "Mofongo de pollo", description: "Con caldo, ajo", price: 14.95, category: "Platos" },
      { name: "Tembleque", description: null, price: 3.5, category: "Postres" },
      { name: "Agua", description: null, price: null, category: null },
    ]);
  });
  it("accepts comma decimals and files without a header", () => {
    expect(parseMenuCsv("Flan;;4,50;Postres")).toEqual([{ name: "Flan", description: null, price: 4.5, category: "Postres" }]);
  });
});
