// @flow
import * as Constants from '../constants/app'

function changedFocus (appFocused: boolean): Constants.ChangedFocus {
  return {payload: {appFocused}, type: 'app:changedFocus'}
}

function appLink (link: string): Constants.AppLink {
  return {payload: {link}, type: 'app:link'}
}

function hideKeyboard (): Constants.HideKeyboard {
  return {payload: undefined, type: 'app:hideKeyboard'}
}

export {
  appLink,
  changedFocus,
  hideKeyboard,
}
