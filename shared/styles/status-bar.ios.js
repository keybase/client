// @flow
import {StatusBarIOS, NativeModules, EmitterSubscription} from 'react-native'

const {StatusBarManager} = NativeModules

class StatusBarSize {
  currentHeight: number
  currentOffset: number
  listener: EmitterSubscription

  constructor() {
    StatusBarManager.getHeight(statusBarFrameData => (this.currentHeight = statusBarFrameData.height))
    this.registerListener()
  }

  registerListener = () => {
    if (this.listener) {
      return
    }
    this.listener = StatusBarIOS.addListener('statusBarFrameWillChange', statusBarData => {
      this.currentHeight = statusBarData.frame.height
      this.currentOffset = this.currentHeight - 20
    })
  }

  removeListener = () => {
    if (this.listener) {
      this.listener.remove()
      this.listener = null
    }
  }
}

const statusBarSize = new StatusBarSize()

export {statusBarSize}
