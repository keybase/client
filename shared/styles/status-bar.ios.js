// @flow
import {StatusBarIOS, NativeModules} from 'react-native'
const {StatusBarManager} = NativeModules

const addSizeListener = (cb: Function) => {
  // call with initial value
  StatusBarManager.getHeight(cb)
  return StatusBarIOS.addListener('statusBarFrameWillChange', statusBarData => cb(statusBarData.frame))
}

export {addSizeListener}
