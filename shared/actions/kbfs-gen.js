// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of kbfs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'kbfs:'
export const clearFuseInstall = 'kbfs:clearFuseInstall'
export const fuseStatus = 'kbfs:fuseStatus'
export const fuseStatusUpdate = 'kbfs:fuseStatusUpdate'
export const installFuse = 'kbfs:installFuse'
export const installFuseFinished = 'kbfs:installFuseFinished'
export const installFuseResult = 'kbfs:installFuseResult'
export const installKBFS = 'kbfs:installKBFS'
export const installKBFSFinished = 'kbfs:installKBFSFinished'
export const installKBFSResult = 'kbfs:installKBFSResult'
export const list = 'kbfs:list'
export const listed = 'kbfs:listed'
export const open = 'kbfs:open'
export const openDefaultPath = 'kbfs:openDefaultPath'
export const openInFileUI = 'kbfs:openInFileUI'
export const uninstallKBFS = 'kbfs:uninstallKBFS'
export const uninstallKBFSResult = 'kbfs:uninstallKBFSResult'

// Payload Types
type _ClearFuseInstallPayload = void
type _FuseStatusPayload = void
type _FuseStatusUpdatePayload = $ReadOnly<{|
  prevStatus: ?RPCTypes.FuseStatus,
  status: RPCTypes.FuseStatus,
|}>
type _InstallFuseFinishedPayload = void
type _InstallFusePayload = void
type _InstallFuseResultPayload = $ReadOnly<{|kextPermissionError: boolean|}>
type _InstallKBFSFinishedPayload = void
type _InstallKBFSPayload = void
type _InstallKBFSResultPayload = $ReadOnly<{|result: RPCTypes.InstallResult|}>
type _ListPayload = $ReadOnly<{|path: string|}>
type _ListedPayload = $ReadOnly<{|result: RPCTypes.ListResult|}>
type _ListedPayloadError = $ReadOnly<{|error: Error|}>
type _OpenDefaultPathPayload = $ReadOnly<{|opening: boolean|}>
type _OpenInFileUIPayload = $ReadOnly<{|path: string|}>
type _OpenPayload = $ReadOnly<{|path?: string|}>
type _UninstallKBFSPayload = void
type _UninstallKBFSResultPayload = $ReadOnly<{|result: RPCTypes.UninstallResult|}>

// Action Creators
export const createClearFuseInstall = (payload: _ClearFuseInstallPayload) => ({error: false, payload, type: clearFuseInstall})
export const createFuseStatus = (payload: _FuseStatusPayload) => ({error: false, payload, type: fuseStatus})
export const createFuseStatusUpdate = (payload: _FuseStatusUpdatePayload) => ({error: false, payload, type: fuseStatusUpdate})
export const createInstallFuse = (payload: _InstallFusePayload) => ({error: false, payload, type: installFuse})
export const createInstallFuseFinished = (payload: _InstallFuseFinishedPayload) => ({error: false, payload, type: installFuseFinished})
export const createInstallFuseResult = (payload: _InstallFuseResultPayload) => ({error: false, payload, type: installFuseResult})
export const createInstallKBFS = (payload: _InstallKBFSPayload) => ({error: false, payload, type: installKBFS})
export const createInstallKBFSFinished = (payload: _InstallKBFSFinishedPayload) => ({error: false, payload, type: installKBFSFinished})
export const createInstallKBFSResult = (payload: _InstallKBFSResultPayload) => ({error: false, payload, type: installKBFSResult})
export const createList = (payload: _ListPayload) => ({error: false, payload, type: list})
export const createListed = (payload: _ListedPayload) => ({error: false, payload, type: listed})
export const createListedError = (payload: _ListedPayloadError) => ({error: true, payload, type: listed})
export const createOpen = (payload: _OpenPayload) => ({error: false, payload, type: open})
export const createOpenDefaultPath = (payload: _OpenDefaultPathPayload) => ({error: false, payload, type: openDefaultPath})
export const createOpenInFileUI = (payload: _OpenInFileUIPayload) => ({error: false, payload, type: openInFileUI})
export const createUninstallKBFS = (payload: _UninstallKBFSPayload) => ({error: false, payload, type: uninstallKBFS})
export const createUninstallKBFSResult = (payload: _UninstallKBFSResultPayload) => ({error: false, payload, type: uninstallKBFSResult})

// Action Payloads
export type ClearFuseInstallPayload = $Call<typeof createClearFuseInstall, _ClearFuseInstallPayload>
export type FuseStatusPayload = $Call<typeof createFuseStatus, _FuseStatusPayload>
export type FuseStatusUpdatePayload = $Call<typeof createFuseStatusUpdate, _FuseStatusUpdatePayload>
export type InstallFuseFinishedPayload = $Call<typeof createInstallFuseFinished, _InstallFuseFinishedPayload>
export type InstallFusePayload = $Call<typeof createInstallFuse, _InstallFusePayload>
export type InstallFuseResultPayload = $Call<typeof createInstallFuseResult, _InstallFuseResultPayload>
export type InstallKBFSFinishedPayload = $Call<typeof createInstallKBFSFinished, _InstallKBFSFinishedPayload>
export type InstallKBFSPayload = $Call<typeof createInstallKBFS, _InstallKBFSPayload>
export type InstallKBFSResultPayload = $Call<typeof createInstallKBFSResult, _InstallKBFSResultPayload>
export type ListPayload = $Call<typeof createList, _ListPayload>
export type ListedPayload = $Call<typeof createListed, _ListedPayload>
export type ListedPayloadError = $Call<typeof createListedError, _ListedPayloadError>
export type OpenDefaultPathPayload = $Call<typeof createOpenDefaultPath, _OpenDefaultPathPayload>
export type OpenInFileUIPayload = $Call<typeof createOpenInFileUI, _OpenInFileUIPayload>
export type OpenPayload = $Call<typeof createOpen, _OpenPayload>
export type UninstallKBFSPayload = $Call<typeof createUninstallKBFS, _UninstallKBFSPayload>
export type UninstallKBFSResultPayload = $Call<typeof createUninstallKBFSResult, _UninstallKBFSResultPayload>

// All Actions
// prettier-ignore
export type Actions =
  | ClearFuseInstallPayload
  | FuseStatusPayload
  | FuseStatusUpdatePayload
  | InstallFuseFinishedPayload
  | InstallFusePayload
  | InstallFuseResultPayload
  | InstallKBFSFinishedPayload
  | InstallKBFSPayload
  | InstallKBFSResultPayload
  | ListPayload
  | ListedPayload
  | ListedPayloadError
  | OpenDefaultPathPayload
  | OpenInFileUIPayload
  | OpenPayload
  | UninstallKBFSPayload
  | UninstallKBFSResultPayload
  | {type: 'common:resetStore', payload: void}
