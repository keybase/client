// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<
  'app:changedFocus',
  {appFocused: boolean}
>
export type AppLink = NoErrorTypedAction<'app:link', {link: string}>
export type HideKeyboard = NoErrorTypedAction<'app:hideKeyboard', void>
export type MobileAppState = NoErrorTypedAction<
  'app:mobileAppState',
  {nextAppState: string}
>

export type Actions = ChangedFocus | AppLink | HideKeyboard
