// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import {type ReturnType} from '../constants/types/more'
import * as RPCTypes from '../constants/types/flow-types'

// Constants
export const resetStore = 'common:resetStore' // not a part of kbfs but is handled by every reducer
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

// Action Creators
export const createClearFuseInstall = () => ({error: false, payload: undefined, type: clearFuseInstall})
export const createFuseStatus = () => ({error: false, payload: undefined, type: fuseStatus})
export const createFuseStatusUpdate = (payload: {|prevStatus: ?RPCTypes.FuseStatus, status: RPCTypes.FuseStatus|}) => ({error: false, payload, type: fuseStatusUpdate})
export const createInstallFuse = () => ({error: false, payload: undefined, type: installFuse})
export const createInstallFuseFinished = () => ({error: false, payload: undefined, type: installFuseFinished})
export const createInstallFuseResult = (payload: {|kextPermissionError: boolean|}) => ({error: false, payload, type: installFuseResult})
export const createInstallKBFS = () => ({error: false, payload: undefined, type: installKBFS})
export const createInstallKBFSFinished = () => ({error: false, payload: undefined, type: installKBFSFinished})
export const createInstallKBFSResult = (payload: {|result: RPCTypes.InstallResult|}) => ({error: false, payload, type: installKBFSResult})
export const createList = (payload: {|path: string|}) => ({error: false, payload, type: list})
export const createListed = (payload: {|result: RPCTypes.ListResult|}) => ({error: false, payload, type: listed})
export const createListedError = (payload: {|error: Error|}) => ({error: true, payload, type: listed})
export const createOpen = (payload: {|path?: string|}) => ({error: false, payload, type: open})
export const createOpenDefaultPath = (payload: {|opening: boolean|}) => ({error: false, payload, type: openDefaultPath})
export const createOpenInFileUI = (payload: {|path: string|}) => ({error: false, payload, type: openInFileUI})
export const createUninstallKBFS = () => ({error: false, payload: undefined, type: uninstallKBFS})

// Action Payloads
export type ClearFuseInstallPayload = ReturnType<typeof createClearFuseInstall>
export type FuseStatusPayload = ReturnType<typeof createFuseStatus>
export type FuseStatusUpdatePayload = ReturnType<typeof createFuseStatusUpdate>
export type InstallFuseFinishedPayload = ReturnType<typeof createInstallFuseFinished>
export type InstallFusePayload = ReturnType<typeof createInstallFuse>
export type InstallFuseResultPayload = ReturnType<typeof createInstallFuseResult>
export type InstallKBFSFinishedPayload = ReturnType<typeof createInstallKBFSFinished>
export type InstallKBFSPayload = ReturnType<typeof createInstallKBFS>
export type InstallKBFSResultPayload = ReturnType<typeof createInstallKBFSResult>
export type ListPayload = ReturnType<typeof createList>
export type ListedPayload = ReturnType<typeof createListed>
export type OpenDefaultPathPayload = ReturnType<typeof createOpenDefaultPath>
export type OpenInFileUIPayload = ReturnType<typeof createOpenInFileUI>
export type OpenPayload = ReturnType<typeof createOpen>
export type UninstallKBFSPayload = ReturnType<typeof createUninstallKBFS>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createClearFuseInstall>
  | ReturnType<typeof createFuseStatus>
  | ReturnType<typeof createFuseStatusUpdate>
  | ReturnType<typeof createInstallFuse>
  | ReturnType<typeof createInstallFuseFinished>
  | ReturnType<typeof createInstallFuseResult>
  | ReturnType<typeof createInstallKBFS>
  | ReturnType<typeof createInstallKBFSFinished>
  | ReturnType<typeof createInstallKBFSResult>
  | ReturnType<typeof createList>
  | ReturnType<typeof createListed>
  | ReturnType<typeof createListedError>
  | ReturnType<typeof createOpen>
  | ReturnType<typeof createOpenDefaultPath>
  | ReturnType<typeof createOpenInFileUI>
  | ReturnType<typeof createUninstallKBFS>
  | {type: 'common:resetStore', payload: void}
