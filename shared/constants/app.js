// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<'app:changedFocus', {appFocused: boolean}>
export type AppLink = NoErrorTypedAction<'app:link', {link: string}>
export type Actions = ChangedFocus | AppLink
