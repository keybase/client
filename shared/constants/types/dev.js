// @flow

export type DebugConfig = {|
  dumbFilter: string,
  dumbFullscreen: boolean,
  dumbIndex: number,
|}

export type State = {
  debugConfig: DebugConfig,
  debugCount: number,
  hmrReloading: boolean,
}
