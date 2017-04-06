// @flow
import type {ChangedFocus} from '../constants/app'

export function changedFocus (focused: boolean): ChangedFocus {
  return {payload: {focused}, type: 'app:changedFocus'}
}
