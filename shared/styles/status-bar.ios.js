// @flow
import {StatusBarIOS} from 'react-native'

const addSizeListener = (cb: Function) => StatusBarIOS.addListener('statusBarFrameWillChange', cb)

export {addSizeListener}
