import assert from "node:assert/strict";
import { test } from "node:test";
import { nairobiInput, nairobiToIso } from "../src/lib/job-format";
test("Nairobi deadlines round-trip independently of the computer timezone", () => {
  assert.equal(nairobiToIso("2026-11-01T09:30"), "2026-11-01T06:30:00.000Z");
  assert.equal(nairobiInput("2026-11-01T06:30:00.000Z"), "2026-11-01T09:30");
});
