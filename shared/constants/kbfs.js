// @flow
import type {TypedAction, NoErrorTypedAction} from './types/flux'
import type {ListResult} from './types/flow-types'

export const fsList = 'fs:list'
export type FSList = NoErrorTypedAction<'fs:list', {path: string}>
export const fsListed = 'fs:fsListed'
export type FSListed = TypedAction<'fs:fsListed', ListResult, void>

export const setupKBFSChangedHandler = 'fs:setupKBFSChangedHandler'
export type SetupKBFSChangedHandler = NoErrorTypedAction<'fs:setupKBFSChangedHandler', void>

export const fsOpen = 'fs:open'
export type FSOpen = NoErrorTypedAction<'fs:open', {path: string}>
