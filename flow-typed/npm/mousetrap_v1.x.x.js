// flow-typed signature: 76b3d276a9b1351060f7bfa650e91854
// flow-typed version: 45acb9a3f7/mousetrap_v1.x.x/flow_>=v0.25.x

declare module "mousetrap" {
  declare module.exports: {
    stopCallback: (
      e: KeyboardEvent,
      element: Element,
      combo: string
    ) => boolean,
    bind(
      key: string | Array<string>,
      fn: (e: Event, combo?: string) => mixed,
      eventType?: string
    ): void,
    unbind(key: string | Array<string>): void,
    trigger(key: string): void,
    reset(): void
  };
}
