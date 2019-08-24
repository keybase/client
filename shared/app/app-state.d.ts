export type State = {
  x: number | null
  y: number | null
  width: number
  height: number
  windowHidden: boolean
  isMaximized: boolean | null
  isFullScreen: boolean | null
  displayBounds: any | null
  tab: string | null
  dockHidden: boolean
  notifySound: boolean
  openAtLogin: boolean
  useNativeFrame: boolean | null
}

declare class AppState {
  state: State
}

export default AppState
