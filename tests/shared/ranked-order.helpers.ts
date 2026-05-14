/// <reference types="vitest/globals" />

import { parseRank, type RankedOrderItem } from "@/lib/shared/ranked-order";

export type TestRankedItem = RankedOrderItem & {
  parentId: string | null;
};

export function getTestParentId(item: TestRankedItem) {
  return item.parentId;
}

export function createRankedItems(): TestRankedItem[] {
  return [
    { id: "root-a", parentId: null, sort_rank: "0|hzzzzz:" },
    { id: "root-b", parentId: null, sort_rank: "0|i00007:" },
    { id: "child-a", parentId: "root-a", sort_rank: "0|i0000f:" },
    { id: "child-b", parentId: "root-a", sort_rank: "0|i0000n:" },
    { id: "child-c", parentId: "root-b", sort_rank: "0|i0000v:" },
  ];
}

export function expectRankAfter(rank: string, previousRank: string) {
  expect(parseRank(rank)).not.toBeNull();
  expect(parseRank(rank)?.compareTo(parseRank(previousRank)!)).toBeGreaterThan(0);
}

export function expectRankBetween(rank: string, previousRank: string, nextRank: string) {
  expectRankAfter(rank, previousRank);
  expect(parseRank(rank)?.compareTo(parseRank(nextRank)!)).toBeLessThan(0);
}