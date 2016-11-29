// @flow
import type {NoErrorTypedAction} from './types/flux'

export const changedFocus = 'window:changedFocus'

export type ChangedFocused = NoErrorTypedAction<'window:changedFocus', boolean>
export type Actions = ChangedFocused
