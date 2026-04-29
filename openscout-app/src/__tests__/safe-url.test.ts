import { describe, expect, it } from "vitest";

import { safeExternalHref } from "@/lib/safe-url";

describe("safeExternalHref", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalHref("https://example.com/path")).toBe("https://example.com/path");
    expect(safeExternalHref("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects unsafe or relative URLs", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("data:text/html,pwn")).toBeNull();
    expect(safeExternalHref("/local/path")).toBeNull();
    expect(safeExternalHref("example.com")).toBeNull();
  });
});
