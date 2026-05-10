import { describe, expect, it } from "vitest";

import { parseStructuredMarkdownList } from "@/lib/notes/markdown-clipboard";

describe("markdown-clipboard", () => {
  it("parses the nested pasted markdown case into parent and child items", () => {
    const markdown = `- ## Weekly Reading
	- [Design Notes](https://example.com/design-notes)
	- [Project Outline](https://example.com/project-outline)
	- [Research Summary](https://example.com/research-summary)
	- [Release Checklist](https://example.com/release-checklist)
	- [Team Decisions](https://example.com/team-decisions)
	- [Open Questions](https://example.com/open-questions)
	- [Implementation Plan](https://example.com/implementation-plan)
	- [Retrospective Draft](https://example.com/retrospective-draft)
-`;

    expect(parseStructuredMarkdownList(markdown)).toEqual([
      {
        text: "## Weekly Reading",
        children: [
          {
            text: "[Design Notes](https://example.com/design-notes)",
            children: [],
          },
          {
            text: "[Project Outline](https://example.com/project-outline)",
            children: [],
          },
          {
            text: "[Research Summary](https://example.com/research-summary)",
            children: [],
          },
          {
            text: "[Release Checklist](https://example.com/release-checklist)",
            children: [],
          },
          {
            text: "[Team Decisions](https://example.com/team-decisions)",
            children: [],
          },
          {
            text: "[Open Questions](https://example.com/open-questions)",
            children: [],
          },
          {
            text: "[Implementation Plan](https://example.com/implementation-plan)",
            children: [],
          },
          {
            text: "[Retrospective Draft](https://example.com/retrospective-draft)",
            children: [],
          },
        ],
      },
      {
        text: "",
        children: [],
      },
    ]);
  });

  it("returns null when the pasted text is not a pure markdown list", () => {
    expect(parseStructuredMarkdownList("Heading\n- child")).toBeNull();
  });

  it("preserves thematic separators between list sections without adding blank blocks", () => {
    const markdown = `- ## Section One
	- [Item A](https://example.com/item-a)
	- [Item B](https://example.com/item-b)
-
---
- ## Section Two
	- [Item C](https://example.com/item-c)
-`;

    expect(parseStructuredMarkdownList(markdown)).toEqual([
      {
        text: "## Section One",
        children: [
          {
            text: "[Item A](https://example.com/item-a)",
            children: [],
          },
          {
            text: "[Item B](https://example.com/item-b)",
            children: [],
          },
        ],
      },
      {
        text: "---",
        children: [],
      },
      {
        text: "## Section Two",
        children: [
          {
            text: "[Item C](https://example.com/item-c)",
            children: [],
          },
        ],
      },
      {
        text: "",
        children: [],
      },
    ]);
  });

  it("preserves thematic breaks as explicit items", () => {
    expect(parseStructuredMarkdownList("- Parent\n---\n- Next")).toEqual([
      {
        text: "Parent",
        children: [],
      },
      {
        text: "---",
        children: [],
      },
      {
        text: "Next",
        children: [],
      },
    ]);
  });

  it("preserves deeper nested subsections inside a pasted outline", () => {
    const markdown = `- ## Trees
	- ### Traversal
		- [Preorder Notes](https://example.com/preorder)
		- [Postorder Notes](https://example.com/postorder)
	- ### Search Trees
		- [Kth Element](https://example.com/kth-element)
-`;

    expect(parseStructuredMarkdownList(markdown)).toEqual([
      {
        text: "## Trees",
        children: [
          {
            text: "### Traversal",
            children: [
              {
                text: "[Preorder Notes](https://example.com/preorder)",
                children: [],
              },
              {
                text: "[Postorder Notes](https://example.com/postorder)",
                children: [],
              },
            ],
          },
          {
            text: "### Search Trees",
            children: [
              {
                text: "[Kth Element](https://example.com/kth-element)",
                children: [],
              },
            ],
          },
        ],
      },
      {
        text: "",
        children: [],
      },
    ]);
  });
});