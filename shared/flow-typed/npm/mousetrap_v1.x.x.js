// flow-typed signature: 56ded3de238736b3f57737044633d3c7
// flow-typed version: b43dff3e0e/mousetrap_v1.x.x/flow_>=v0.21.x

declare module 'mousetrap' {
  declare function bind(key: string|Array<string>, fn: (e: Event, combo?: string) => mixed, eventType?: string): void;
  declare function unbind(key: string): void;
  declare function trigger(key: string): void;
  declare var stopCallback: (e: KeyboardEvent, element: Element, combo: string) => bool;
  declare function reset(): void;
}
