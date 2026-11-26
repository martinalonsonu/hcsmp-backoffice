import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEmail } from "./firebase/registration.ts";

test("normalizeEmail turns missing stored emails into a readable error, not a TypeError", () => {
  for (const missing of [undefined, null, "", "   "]) {
    assert.throws(() => normalizeEmail(missing), /correo electrónico válido/);
  }
  assert.equal(normalizeEmail("  Foo@Bar.com "), "foo@bar.com");
});
