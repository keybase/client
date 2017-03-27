// @flow
import type {ChangedFocus} from '../constants/app'

export function changedFocus (focus: boolean): ChangedFocus {
  return {type: 'app:changedFocus', payload: focus}
}
