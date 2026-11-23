import { test, expect } from "vitest";

import { validateCreateShortInput } from "./validator";

test("reports every invalid field by its path", () => {
  let thrown: unknown;
  try {
    validateCreateShortInput({
      scenes: [{ text: "Hallo" }],
      config: { voice: "not-a-voice" },
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  const result = JSON.parse((thrown as Error).message);
  expect(Object.keys(result.missingFields).sort()).toEqual([
    "config.voice",
    "scenes.0.searchTerms",
  ]);
  expect(result.message).toBe(
    "Validation failed for 2 field(s): scenes.0.searchTerms, config.voice",
  );
});

test("returns the parsed input when it is valid", () => {
  const input = {
    scenes: [{ text: "Hallo", searchTerms: ["bike", "forest"] }],
    config: { voice: "af_heart" },
  };
  expect(validateCreateShortInput(input)).toEqual(input);
});
