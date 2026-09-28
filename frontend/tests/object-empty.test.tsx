import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { objectQuery } from "../src/features/objects/queries";

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

describe("object lookup", () => {
  it("reads 'nothing catalogued here' as no object", async () => {
    answer(200, { object: null, message: "SIMBAD lists no object within 36″ of this position.", credit: "SIMBAD" });
    const client = new QueryClient();
    await expect(client.fetchQuery(objectQuery(326.891, -7.683))).resolves.toBeNull();
  });

  it("reads a spot the demo snapshot did not record as no object too", async () => {
    answer(404, { error: { code: "not_in_snapshot", message: "Not recorded." } });
    const client = new QueryClient();
    await expect(client.fetchQuery(objectQuery(1.5, 2.5, "snapshot"))).resolves.toBeNull();
  });

  it("passes a catalogued object through", async () => {
    answer(200, { id: "M  31", name: "Andromeda Galaxy" });
    const client = new QueryClient();
    await expect(client.fetchQuery(objectQuery(10.684708, 41.26875))).resolves.toMatchObject({ id: "M  31" });
  });
});
