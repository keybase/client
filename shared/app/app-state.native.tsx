import {State} from './app-state'

export default class AppState {
  state: State

  constructor() {
    this.state = {
      displayBounds: null,
      dockHidden: false,
      height: 0,
      isFullScreen: null,
      isMaximized: null,
      notifySound: false,
      openAtLogin: false,
      tab: null,
      useNativeFrame: null,
      width: 0,
      windowHidden: false,
      x: null,
      y: null,
    }
  }
}
