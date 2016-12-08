// @flow
import * as Constants from '../constants/window'

import type {ChangedFocus} from '../constants/window'

export function changedFocus (focus: boolean): ChangedFocus {
  return {type: Constants.changedFocus, payload: focus}
}
