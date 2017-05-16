// @flow
import * as Constants from '../constants/dev'
import type {DebugConfig, UpdateDebugConfig} from '../constants/dev'

export function updateDebugConfig(value: DebugConfig): UpdateDebugConfig {
  return {payload: value, type: Constants.updateDebugConfig}
}
