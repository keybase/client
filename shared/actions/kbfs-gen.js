// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'

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
export const uninstallKBFSResult = 'kbfs:uninstallKBFSResult'

// Action Creators
export const createClearFuseInstall = () => ({error: false, payload: undefined, type: clearFuseInstall})
export const createFuseStatus = () => ({error: false, payload: undefined, type: fuseStatus})
export const createFuseStatusUpdate = (payload: {|+prevStatus: ?RPCTypes.FuseStatus, +status: RPCTypes.FuseStatus|}) => ({error: false, payload, type: fuseStatusUpdate})
export const createInstallFuse = () => ({error: false, payload: undefined, type: installFuse})
export const createInstallFuseFinished = () => ({error: false, payload: undefined, type: installFuseFinished})
export const createInstallFuseResult = (payload: {|+kextPermissionError: boolean|}) => ({error: false, payload, type: installFuseResult})
export const createInstallKBFS = () => ({error: false, payload: undefined, type: installKBFS})
export const createInstallKBFSFinished = () => ({error: false, payload: undefined, type: installKBFSFinished})
export const createInstallKBFSResult = (payload: {|+result: RPCTypes.InstallResult|}) => ({error: false, payload, type: installKBFSResult})
export const createList = (payload: {|+path: string|}) => ({error: false, payload, type: list})
export const createListed = (payload: {|+result: RPCTypes.ListResult|}) => ({error: false, payload, type: listed})
export const createListedError = (payload: {|+error: Error|}) => ({error: true, payload, type: listed})
export const createOpen = (payload: {|+path?: string|}) => ({error: false, payload, type: open})
export const createOpenDefaultPath = (payload: {|+opening: boolean|}) => ({error: false, payload, type: openDefaultPath})
export const createOpenInFileUI = (payload: {|+path: string|}) => ({error: false, payload, type: openInFileUI})
export const createUninstallKBFS = () => ({error: false, payload: undefined, type: uninstallKBFS})
export const createUninstallKBFSResult = (payload: {|+result: RPCTypes.UninstallResult|}) => ({error: false, payload, type: uninstallKBFSResult})

// Action Payloads
export type ClearFuseInstallPayload = More.ReturnType<typeof createClearFuseInstall>
export type FuseStatusPayload = More.ReturnType<typeof createFuseStatus>
export type FuseStatusUpdatePayload = More.ReturnType<typeof createFuseStatusUpdate>
export type InstallFuseFinishedPayload = More.ReturnType<typeof createInstallFuseFinished>
export type InstallFusePayload = More.ReturnType<typeof createInstallFuse>
export type InstallFuseResultPayload = More.ReturnType<typeof createInstallFuseResult>
export type InstallKBFSFinishedPayload = More.ReturnType<typeof createInstallKBFSFinished>
export type InstallKBFSPayload = More.ReturnType<typeof createInstallKBFS>
export type InstallKBFSResultPayload = More.ReturnType<typeof createInstallKBFSResult>
export type ListPayload = More.ReturnType<typeof createList>
export type ListedPayload = More.ReturnType<typeof createListed>
export type OpenDefaultPathPayload = More.ReturnType<typeof createOpenDefaultPath>
export type OpenInFileUIPayload = More.ReturnType<typeof createOpenInFileUI>
export type OpenPayload = More.ReturnType<typeof createOpen>
export type UninstallKBFSPayload = More.ReturnType<typeof createUninstallKBFS>
export type UninstallKBFSResultPayload = More.ReturnType<typeof createUninstallKBFSResult>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createClearFuseInstall>
  | More.ReturnType<typeof createFuseStatus>
  | More.ReturnType<typeof createFuseStatusUpdate>
  | More.ReturnType<typeof createInstallFuse>
  | More.ReturnType<typeof createInstallFuseFinished>
  | More.ReturnType<typeof createInstallFuseResult>
  | More.ReturnType<typeof createInstallKBFS>
  | More.ReturnType<typeof createInstallKBFSFinished>
  | More.ReturnType<typeof createInstallKBFSResult>
  | More.ReturnType<typeof createList>
  | More.ReturnType<typeof createListed>
  | More.ReturnType<typeof createListedError>
  | More.ReturnType<typeof createOpen>
  | More.ReturnType<typeof createOpenDefaultPath>
  | More.ReturnType<typeof createOpenInFileUI>
  | More.ReturnType<typeof createUninstallKBFS>
  | More.ReturnType<typeof createUninstallKBFSResult>
  | {type: 'common:resetStore', payload: void}
