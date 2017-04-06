// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<'app:changedFocus', {appFocused: boolean}>
export type Actions = ChangedFocus
