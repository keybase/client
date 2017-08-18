declare module 'mousetrap' {
  declare function bind(key: string|Array<string>, fn: (e: Event, combo?: string) => mixed, eventType?: string): void;
  declare function unbind(key: string): void;
  declare function trigger(key: string): void;
  declare var stopCallback: (e: KeyboardEvent, element: Element, combo: string) => bool;
  declare function reset(): void;
}
