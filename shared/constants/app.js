// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<'app:changedFocus', {appFocused: boolean}>
export type ChangedActive = NoErrorTypedAction<'app:changedActive', {userActive: boolean}>
export type AppLink = NoErrorTypedAction<'app:link', {link: string}>
export type MobileAppState = NoErrorTypedAction<'app:mobileAppState', {nextAppState: string}>

export type Actions = ChangedFocus | ChangedActive | AppLink
