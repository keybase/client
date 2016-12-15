// @flow
import type {NoErrorTypedAction} from './types/flux'

export const changedFocus = 'window:changedFocus'

export type ChangedFocus = NoErrorTypedAction<'window:changedFocus', boolean>
export type Actions = ChangedFocus
