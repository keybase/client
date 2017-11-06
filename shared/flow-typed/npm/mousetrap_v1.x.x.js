// flow-typed signature: 2392169c374d3a6068c80108ea652f58
// flow-typed version: 21872c9248/mousetrap_v1.x.x/flow_>=v0.21.x

declare module 'mousetrap' {
  declare function bind(key: string|Array<string>, fn: (e: Event, combo?: string) => mixed, eventType?: string): void;
  declare function unbind(key: string | Array<string>): void;
  declare function trigger(key: string): void;
  declare var stopCallback: (e: KeyboardEvent, element: Element, combo: string) => bool;
  declare function reset(): void;
}
