// @flow
import {StatusBarIOS, NativeModules} from 'react-native'
const {StatusBarManager} = NativeModules

const addSizeListener = (cb: Function) => {
  // gcall with initial value
  StatusBarManager.getHeight(cb)
  return StatusBarIOS.addListener('statusBarFrameWillChange', statusBarData => cb(statusBarData.frame))
}

export {addSizeListener}
