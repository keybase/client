// @flow
import type {TypedAction, NoErrorTypedAction} from './types/flux'
import type {FuseStatus, InstallResult, ListResult} from './types/flow-types'

export const fsList = 'fs:list'
export type FSList = NoErrorTypedAction<'fs:list', {path: string}>
export const fsListed = 'fs:fsListed'
export type FSListed = TypedAction<'fs:fsListed', ListResult, void>

export const fsOpen = 'fs:open'
export type FSOpen = NoErrorTypedAction<'fs:open', {path: string}>

export type OpenInFileUI = NoErrorTypedAction<'fs:openInFileUI', {path: string}>

export type FSFuseStatus = NoErrorTypedAction<'fs:fuseStatus', void>
export type FSFuseStatusUpdate = NoErrorTypedAction<
  'fs:fuseStatusUpdate',
  {prevStatus: ?FuseStatus, status: FuseStatus}
>

export type FSInstallFuse = NoErrorTypedAction<'fs:installFuse', void>

export type FSInstallFuseResult = NoErrorTypedAction<'fs:installFuseResult', {kextPermissionError: boolean}>

export type FSInstallFuseFinished = NoErrorTypedAction<'fs:installFuseFinished', void>

export type FSClearFuseInstall = NoErrorTypedAction<'fs:clearFuseInstall', void>

export type FSInstallKBFS = NoErrorTypedAction<'fs:installKBFS', void>

export type FSInstallKBFSResult = NoErrorTypedAction<'fs:installKBFSResult', {result: InstallResult}>

export type FSInstallKBFSFinished = NoErrorTypedAction<'fs:installKBSFinished', void>

export type FSOpenDefaultPath = NoErrorTypedAction<'fs:openDefaultPath', {opening: boolean}>

export type FSUninstallKBFS = NoErrorTypedAction<'fs:uninstallKBFS', void>
