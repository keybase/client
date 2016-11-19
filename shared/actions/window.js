// @flow
import * as Constants from '../constants/window'

import type {ChangedFocused} from '../constants/window'

export function changedFocus (focus: boolean): ChangedFocused {
  return {type: Constants.changedFocus, payload: focus}
}
