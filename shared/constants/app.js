// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<'app:changedFocus', {focused: boolean}>
export type Actions = ChangedFocus
