export type TestTreeBlock = {
  id: string;
  parent_block_id: string | null;
};

export function createNestedTreeBlocks(): TestTreeBlock[] {
  return [
    { id: "a", parent_block_id: null },
    { id: "b", parent_block_id: "a" },
    { id: "c", parent_block_id: "b" },
    { id: "d", parent_block_id: null },
    { id: "e", parent_block_id: "a" },
  ];
}