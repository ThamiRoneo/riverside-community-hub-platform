import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dayBounds, overlaps } from "../src/lib/dates";
import { csvCell, csvDocument } from "../src/lib/csv";
import { pagination } from "../src/lib/pagination";

describe("dates", () => {
  test("dayBounds returns UTC bounds for valid date", () => {
    const bounds = dayBounds("2026-10-26");
    assert.ok(bounds);
    assert.equal(bounds.start, "2026-10-26T00:00:00.000Z");
    assert.equal(bounds.end, "2026-10-27T00:00:00.000Z");
  });

  test("dayBounds rejects invalid date", () => {
    assert.equal(dayBounds("2026-02-31"), null);
    assert.equal(dayBounds("not-a-date"), null);
    assert.equal(dayBounds("2026/10/26"), null);
  });

  test("overlaps detects overlap correctly", () => {
    assert.equal(
      overlaps("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z", "2026-10-26T09:30:00Z", "2026-10-26T10:30:00Z"),
      true,
    );
    assert.equal(
      overlaps("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z", "2026-10-26T10:00:00Z", "2026-10-26T11:00:00Z"),
      false,
    );
  });
});

describe("csv", () => {
  test("csvCell escapes quotes", () => {
    assert.equal(csvCell('hello "world"'), '"hello ""world"""');
  });

  test("csvCell neutralizes formula injection", () => {
    assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
    assert.equal(csvCell("+123"), '"\'+123"');
    assert.equal(csvCell("-123"), '"\'-123"');
    assert.equal(csvCell("@cmd"), '"\'@cmd"');
  });

  test("csvCell handles null/undefined", () => {
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell(undefined), '""');
  });

  test("csvDocument joins rows", () => {
    const doc = csvDocument(["a", "b"], ['"1","2"']);
    assert.equal(doc, 'a,b\n"1","2"');
  });
});

describe("pagination", () => {
  test("defaults to page 1 page_size 10", () => {
    const p = pagination({});
    assert.equal(p.page, 1);
    assert.equal(p.pageSize, 10);
    assert.equal(p.offset, 0);
  });

  test("caps page_size at 100", () => {
    const p = pagination({ page_size: "200" });
    assert.equal(p.pageSize, 100);
  });

  test("falls back to defaults for invalid values", () => {
    const p = pagination({ page: "0", page_size: "0" });
    assert.equal(p.page, 1);
    assert.equal(p.pageSize, 10);
  });
});
