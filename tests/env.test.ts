import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getEnv } from "../src/lib/env";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

test("development supports starting without a database", () => {
  process.env = { ...process.env, NODE_ENV: "development" };
  delete process.env.DATABASE_URL;
  delete process.env.APP_URL;
  assert.equal(getEnv().DATABASE_URL, undefined);
  assert.equal(getEnv().APP_URL, "http://localhost:3000");
});

test("production refuses an insecure public URL", () => {
  process.env = { ...process.env, NODE_ENV: "production" };
  process.env.APP_URL = "http://example.test";
  delete process.env.DATABASE_URL;
  assert.throws(() => getEnv(), /HTTPS/);
});

test("configuration failures do not disclose database credentials", () => {
  process.env = { ...process.env, NODE_ENV: "development" };
  process.env.DATABASE_URL = "mysql://user:super-secret@example.test/db";
  assert.throws(() => getEnv(), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /DATABASE_URL/);
    assert.doesNotMatch(error.message, /super-secret/);
    return true;
  });
});
