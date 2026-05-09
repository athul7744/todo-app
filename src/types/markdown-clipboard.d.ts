declare module "turndown" {
  export default class TurndownService {
    constructor(options?: Record<string, unknown>);
    addRule(
      key: string,
      rule: {
        filter: (node: Node) => boolean;
        replacement: (content: string, node: Node) => string;
      }
    ): void;
    turndown(input: string): string;
    use(plugin: unknown): void;
  }
}

declare module "turndown-plugin-gfm" {
  export function gfm(service: unknown): void;
}