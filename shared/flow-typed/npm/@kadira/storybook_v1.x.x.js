// flow-typed signature: 7c10ef1a9ce4a843032e8e781bd27edf
// flow-typed version: 4d90ef4a8b/@kadira/storybook_v1.x.x/flow_>=v0.30.x

declare module '@kadira/storybook' {
  declare interface Story {
    add: (storyName: string, callback: Function) => Story;
  }

  declare function storiesOf(name: string, module: any): Story;
  declare function action(name: string): Function;
}
