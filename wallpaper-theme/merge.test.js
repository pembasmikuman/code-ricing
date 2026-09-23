const { test, expect } = require("bun:test");
const { parseColors, mergeColors } = require("./merge");

test("parseColors accepts an object of strings", () => {
  expect(parseColors('{"editor.background":"#0f1416"}')).toEqual({ "editor.background": "#0f1416" });
});

test("parseColors rejects half-written JSON", () => {
  expect(() => parseColors('{"editor.background":"#0f')).toThrow();
});

test("parseColors rejects arrays and non-string values", () => {
  expect(() => parseColors("[]")).toThrow("object");
  expect(() => parseColors('{"editor.background":5}')).toThrow("editor.background");
});

test("mergeColors keeps hand-added and theme-scoped keys, file keys win", () => {
  const scoped = { "editor.background": "#111111" };
  const current = { "editor.background": "#000000", "my.custom": "#abcdef", "[Default Dark Modern]": scoped };
  const merged = mergeColors(current, { "editor.background": "#0f1416" });
  expect(merged).toEqual({ "editor.background": "#0f1416", "my.custom": "#abcdef", "[Default Dark Modern]": scoped });
});

test("mergeColors returns null when nothing changes", () => {
  const current = { "editor.background": "#0f1416", "my.custom": "#abcdef" };
  expect(mergeColors(current, { "editor.background": "#0f1416" })).toBeNull();
});

test("mergeColors works with no existing customizations", () => {
  expect(mergeColors({}, { focusBorder: "#88ccee" })).toEqual({ focusBorder: "#88ccee" });
});
