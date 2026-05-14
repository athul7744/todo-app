/// <reference types="vitest/globals" />

import type { Tag } from "@/lib/powersync/AppSchema";
import { parseStoredTagIds, resolveNoteTags } from "@/components/notes/page/utils";

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