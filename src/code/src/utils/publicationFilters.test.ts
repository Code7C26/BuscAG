import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublications, emptyFilters } from "./publicationFilters";
import type { Item } from "../types";
const rows = [
  {
    id: "a",
    title: "Mochila azul",
    description: "",
    category: "Otros",
    locationName: "Córdoba Centro",
    status: "perdido",
    date: "2026-11-05",
    createdAt: "2026-11-06",
    distanceKm: 2,
    user: { id: "a" },
  },
  {
    id: "b",
    title: "Mochila azul",
    description: "",
    category: "Otros",
    locationName: "Córdoba Norte",
    status: "encontrado",
    date: "2026-11-06",
    createdAt: "2026-11-07",
    distanceKm: 1,
    user: { id: "b" },
  },
] as Item[];
test("combined filters distinguish ownership, dates, locality and status without modifying original rows", () => {
  const args = {
    query: "mochila",
    category: "Todos",
    status: "todos" as const,
    userId: "a",
    advanced: {
      ...emptyFilters,
      zone: "cordoba",
      from: "2026-11-05",
      to: "2026-11-06",
      ownership: "mine" as const,
    },
  };
  assert.deepEqual(
    filterPublications(rows, args).map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    filterPublications(rows, {
      ...args,
      advanced: { ...args.advanced, ownership: "others" },
    }).map((r) => r.id),
    ["b"],
  );
  assert.equal(rows[0].id, "a");
});
test("default order remains newest first and distance sorting excludes no unlocated publication", () => {
  const args = {
    query: "",
    category: "Todos",
    status: "todos" as const,
    userId: "a",
    advanced: emptyFilters,
  };
  assert.deepEqual(
    filterPublications(rows, args).map((r) => r.id),
    ["b", "a"],
  );
  assert.deepEqual(
    filterPublications(rows, {
      ...args,
      advanced: { ...emptyFilters, sort: "oldest" },
    }).map((r) => r.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterPublications(rows, { ...args, query: "no existe" }),
    [],
  );
});
test("timestamp filters use the displayed local calendar day and DATE fields never shift", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Argentina/Buenos_Aires";
  try {
    const candidates = [
      { ...rows[0], date: "2026-11-06T01:00:00Z" },
      { ...rows[1], date: "2026-11-06" },
    ];
    const result = filterPublications(candidates, {
      query: "",
      category: "Todos",
      status: "todos",
      userId: "a",
      advanced: { ...emptyFilters, from: "2026-11-05", to: "2026-11-05" },
    });
    assert.deepEqual(
      result.map((row) => row.id),
      ["a"],
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
