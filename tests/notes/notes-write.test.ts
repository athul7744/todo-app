import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.fn(async () => undefined);
const getAllMock = vi.fn(async () => []);
const getOptionalMock = vi.fn(async () => null);
const getCurrentUserIdMock = vi.fn(async () => "user-1");

vi.mock("@/lib/powersync/db", () => ({
  db: {
    execute: executeMock,
    getAll: getAllMock,
    getOptional: getOptionalMock,
  },
}));

vi.mock("@/lib/shared/auth", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

describe("notes writes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    executeMock.mockResolvedValue(undefined);
    getAllMock.mockResolvedValue([]);
    getOptionalMock.mockResolvedValue(null);
    getCurrentUserIdMock.mockResolvedValue("user-1");
  });

  it("flushes pending same-page block creates as one multi-row insert", async () => {
    const { queueNoteBlockCreates } = await import("@/lib/notes/notes");
    const { flushExecutes } = await import("@/lib/shared/debounced-update");

    await queueNoteBlockCreates([
      {
        id: "block-1",
        pageId: "page-1",
        sortRank: "a0",
        type: "text",
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] },
      },
      {
        id: "block-2",
        pageId: "page-1",
        parentBlockId: "block-1",
        sortRank: "a1",
        type: "text",
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] },
      },
    ]);

    await flushExecutes();

    const executeCalls = executeMock.mock.calls as unknown[][];
    const insertCalls = executeCalls.filter((call) => String(call[0] ?? "").includes("INSERT INTO blocks"));
    expect(insertCalls).toHaveLength(1);

    const insertCall = insertCalls.at(0);
    if (!insertCall) {
      throw new Error("Expected a batched block insert call");
    }

    const insertSql = String(insertCall[0]);
    const insertParams = insertCall[1] as unknown[];
    expect(insertSql).toContain("INSERT INTO blocks");
    expect(insertSql.match(/\(\?, \?, \?, \?, \?, \?, \?, \?\)/g)).toHaveLength(2);
    expect(insertParams).toHaveLength(16);
    expect(insertParams.slice(0, 8)).toEqual([
      "block-1",
      "user-1",
      "page-1",
      null,
      "text",
      JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] }),
      "a0",
      expect.any(String),
    ]);
    expect(insertParams.slice(8, 16)).toEqual([
      "block-2",
      "user-1",
      "page-1",
      "block-1",
      "text",
      JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] }),
      "a1",
      expect.any(String),
    ]);

    await flushExecutes();

    expect(executeCalls.some((call) => String(call[0] ?? "").includes("UPDATE pages SET updated_at"))).toBe(true);
  });

  it("retries queued block creates after an insert flush failure", async () => {
    const { queueNoteBlockCreate } = await import("@/lib/notes/notes");
    const { flushExecutes, hasPendingWrites } = await import("@/lib/shared/debounced-update");

    let shouldFailInsert = true;
    executeMock.mockImplementation(async (...args: unknown[]) => {
      if (String(args[0] ?? "").includes("INSERT INTO blocks") && shouldFailInsert) {
        throw new Error("insert failed");
      }
      return undefined;
    });

    await queueNoteBlockCreate({
      id: "block-retry",
      pageId: "page-retry",
      sortRank: "a0",
      type: "text",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Retry me" }] }] },
    });

    await expect(flushExecutes()).rejects.toThrow("insert failed");
    expect(hasPendingWrites()).toBe(true);

    shouldFailInsert = false;

    await flushExecutes();

    const executeCalls = executeMock.mock.calls as unknown[][];
    expect(executeCalls.filter((call) => String(call[0] ?? "").includes("INSERT INTO blocks"))).toHaveLength(2);
  });

  it("uses the latest pending content when a queued block is updated before flush", async () => {
    const { queueNoteBlockCreate, updateNoteBlock } = await import("@/lib/notes/notes");
    const { flushExecutes } = await import("@/lib/shared/debounced-update");

    await queueNoteBlockCreate({
      id: "block-update",
      pageId: "page-update",
      sortRank: "a0",
      type: "text",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }] },
    });

    updateNoteBlock({
      blockId: "block-update",
      pageId: "page-update",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }] },
    });

    await flushExecutes();

    const executeCalls = executeMock.mock.calls as unknown[][];
    const insertCall = executeCalls.find((call) => String(call[0] ?? "").includes("INSERT INTO blocks"));
    expect(insertCall).toBeTruthy();
    expect((insertCall?.[1] as unknown[])[5]).toBe(JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }] }));
  });

  it("cancels queued inserts when a pending block is deleted before flush", async () => {
    const { queueNoteBlockCreate, deleteNoteBlock } = await import("@/lib/notes/notes");
    const { flushExecutes } = await import("@/lib/shared/debounced-update");

    await queueNoteBlockCreate({
      id: "block-delete",
      pageId: "page-delete",
      sortRank: "a0",
      type: "text",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "To delete" }] }] },
    });

    await deleteNoteBlock("block-delete", "page-delete");
    await flushExecutes();

    const executeCalls = executeMock.mock.calls as unknown[][];
    expect(executeCalls.some((call) => String(call[0] ?? "").includes("INSERT INTO blocks"))).toBe(false);
  });

  it("creates the starter page block immediately without waiting for the debounced queue", async () => {
    const { createStarterPage } = await import("@/lib/notes/notes");

    await createStarterPage("Immediate starter");

    const executeCalls = executeMock.mock.calls as unknown[][];
    const pageInsertCall = executeCalls.find((call) => String(call[0] ?? "").includes("INSERT INTO pages"));
    const blockInsertCall = executeCalls.find((call) => String(call[0] ?? "").includes("INSERT INTO blocks"));

    expect(pageInsertCall).toBeTruthy();
    expect(blockInsertCall).toBeTruthy();
  });
});