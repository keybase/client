// @flow
import {StatusBar} from 'react-native'

class StatusBarSize {
  // $FlowIssue
  get currentHeight() {
    return StatusBar.currentHeight
  }
  currentOffset = 0
}

const statusBarSize = new StatusBarSize()

export {statusBarSize}
