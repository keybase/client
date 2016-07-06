// @flow
import * as Constants from '../constants/dev'
import type {DebugConfig, DevAction} from '../constants/dev'

export function updateDebugConfig (value: DebugConfig): DevAction {
  return {type: Constants.updateDebugConfig, value: value}
}
