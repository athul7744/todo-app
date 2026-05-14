/// <reference types="vitest/globals" />

import {
  getNextRank,
  getRankAfter,
  getRankAfterItem,
  getRankAtParentEnd,
  getSiblingItems,
  parseRank,
} from "@/lib/shared/ranked-order";
import {
  createRankedItems,
  expectRankAfter,
  expectRankBetween,
  getTestParentId,
} from "@/../tests/shared/ranked-order.helpers";

const items = createRankedItems();

describe("ranked-order", () => {
  it("parses valid ranks and ignores invalid ones", () => {
    expect(parseRank("0|hzzzzz:")).not.toBeNull();
    expect(parseRank("not-a-rank")).toBeNull();
  });

  it("returns the next rank after the largest valid input", () => {
    const nextRank = getNextRank(["0|hzzzzz:", "0|i00007:", "invalid"]);

    expectRankAfter(nextRank, "0|i00007:");
  });

  it("returns a rank between siblings when both ranks are present", () => {
    const betweenRank = getRankAfter("0|hzzzzz:", "0|i00007:");

    expectRankBetween(betweenRank, "0|hzzzzz:", "0|i00007:");
  });

  it("filters sibling items by normalized parent id", () => {
    expect(getSiblingItems(items, undefined, getTestParentId).map((item) => item.id)).toEqual(["root-a", "root-b"]);
    expect(getSiblingItems(items, "root-a", getTestParentId).map((item) => item.id)).toEqual(["child-a", "child-b"]);
  });

  it("computes the rank at the end of a parent scope", () => {
    const nextRank = getRankAtParentEnd(items, "root-a", getTestParentId);
    expectRankAfter(nextRank, "0|i0000n:");
  });

  it("computes the rank immediately after a sibling inside a parent scope", () => {
    const insertedRank = getRankAfterItem(items, "child-a", "root-a", getTestParentId);

    expectRankBetween(insertedRank, "0|i0000f:", "0|i0000n:");
  });

  it("falls back to the end of the parent scope when the sibling is missing", () => {
    const fallbackRank = getRankAfterItem(items, "missing", "root-a", getTestParentId);
    expectRankAfter(fallbackRank, "0|i0000n:");
  });

  it("uses sort-rank order rather than array order when inserting after a newly appended sibling", () => {
    const unsortedWorkingItems = [
      { id: "root-a", parentId: null, sort_rank: "0|hzzzzz:" },
      { id: "root-b", parentId: null, sort_rank: "0|i00007:" },
      { id: "inserted", parentId: null, sort_rank: "0|hyzzzz:" },
    ];

    const insertedRank = getRankAfterItem(unsortedWorkingItems, "inserted", null, getTestParentId);
    expectRankBetween(insertedRank, "0|hyzzzz:", "0|i00007:");
  });
});