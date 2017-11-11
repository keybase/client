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

export const initialState: State = {
  debugConfig: {
    dumbFilter: '',
    dumbFullscreen: false,
    dumbIndex: 0,
  },
  debugCount: 0,
  hmrReloading: false,
}
