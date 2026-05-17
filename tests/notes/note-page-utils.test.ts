/// <reference types="vitest/globals" />

import type { Tag } from "@/lib/powersync/AppSchema";
import { buildOutlineEntries, extractOutlineEntries, parseStoredTagIds, resolveNoteTags } from "@/components/notes/page/utils";

function createTag(overrides: Partial<Tag> & Pick<Tag, "id">): Tag {
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? "user-1",
    name: overrides.name ?? "Default",
    color: overrides.color ?? "slate",
    created_at: overrides.created_at ?? "2026-05-15T00:00:00.000Z",
  };
}

describe("note-page utils", () => {
  it("extracts outline entries from double-encoded heading content", () => {
    const headingDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Visible heading" }],
        },
      ],
    };

    expect(extractOutlineEntries("block-1", JSON.stringify(JSON.stringify(headingDocument)))).toEqual([
      {
        blockId: "block-1",
        indentLevel: 0,
        level: 2,
        text: "Visible heading",
      },
    ]);
  });

  it("indents outline entries only for actual nested child blocks", () => {
    const heading = (text: string, level: number) => JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level },
          content: [{ type: "text", text }],
        },
      ],
    });

    expect(buildOutlineEntries([
      { id: "root-1", parent_block_id: null, content: heading("Root A", 2) },
      { id: "root-2", parent_block_id: null, content: heading("Root B", 4) },
      { id: "child-1", parent_block_id: "root-2", content: heading("Child", 1) },
    ])).toEqual([
      {
        blockId: "root-1",
        indentLevel: 0,
        level: 2,
        text: "Root A",
      },
      {
        blockId: "root-2",
        indentLevel: 0,
        level: 4,
        text: "Root B",
      },
      {
        blockId: "child-1",
        indentLevel: 1,
        level: 1,
        text: "Child",
      },
    ]);
  });

  it("parses stored tag ids while dropping blanks, duplicates, and non-string values", () => {
    expect(parseStoredTagIds([" alpha ", "", null, "beta", "alpha", 42, " beta "])).toEqual(["alpha", "beta"]);
    expect(parseStoredTagIds("alpha")).toEqual([]);
  });

  it("resolves note tags in id order and skips missing tags", () => {
    const tags = [
      createTag({ id: "tag-1", name: "Work", color: "emerald" }),
      createTag({ id: "tag-2", name: "", color: null }),
      createTag({ id: "tag-3", name: "Home", color: "rose" }),
    ];

    expect(resolveNoteTags(["tag-3", "missing", "tag-2"], tags)).toEqual([
      {
        id: "tag-3",
        key: "tag-3",
        name: "Home",
        color: "rose",
      },
      {
        id: "tag-2",
        key: "tag-2",
        name: "Tag",
        color: "slate",
      },
    ]);
  });
});