// @flow
import type {ChangedFocus} from '../constants/app'

export function changedFocus (appFocused: boolean): ChangedFocus {
  return {payload: {appFocused}, type: 'app:changedFocus'}
}
