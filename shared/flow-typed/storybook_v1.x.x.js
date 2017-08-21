declare module '@kadira/storybook' {
  declare interface Story {
    add: (storyName: string, callback: Function) => Story;
  }

  declare function storiesOf(name: string, module: any): Story;
  declare function action(name: string): Function;
}
