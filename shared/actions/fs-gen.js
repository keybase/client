// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const dismissTransfer = 'fs:dismissTransfer'
export const download = 'fs:download'
export const downloadFinished = 'fs:downloadFinished'
export const downloadStarted = 'fs:downloadStarted'
export const fileTransferProgress = 'fs:fileTransferProgress'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fuseStatus = 'fs:fuseStatus'
export const fuseStatusUpdate = 'fs:fuseStatusUpdate'
export const openInFileUI = 'fs:openInFileUI'
export const sortSetting = 'fs:sortSetting'

// Action Creators
export const createDismissTransfer = (payload: $ReadOnly<{key: string}>) => ({error: false, payload, type: dismissTransfer})
export const createDownload = (
  payload: $ReadOnly<{
    path: Types.Path,
    localPath?: string,
  }>
) => ({error: false, payload, type: download})
export const createDownloadFinished = (
  payload: $ReadOnly<{
    key: string,
    error?: string,
  }>
) => ({error: false, payload, type: downloadFinished})
export const createDownloadStarted = (
  payload: $ReadOnly<{
    key: string,
    path: Types.Path,
    localPath: Types.LocalPath,
  }>
) => ({error: false, payload, type: downloadStarted})
export const createFileTransferProgress = (
  payload: $ReadOnly<{
    key: string,
    completePortion: number,
  }>
) => ({error: false, payload, type: fileTransferProgress})
export const createFolderListLoad = (payload: $ReadOnly<{path: Types.Path}>) => ({error: false, payload, type: folderListLoad})
export const createFolderListLoaded = (
  payload: $ReadOnly<{
    path: Types.Path,
    pathItems: I.Map<Types.Path, Types.PathItem>,
  }>
) => ({error: false, payload, type: folderListLoaded})
export const createFuseStatus = () => ({error: false, payload: undefined, type: fuseStatus})
export const createFuseStatusUpdate = (
  payload: $ReadOnly<{
    prevStatus: ?RPCTypes.FuseStatus,
    status: RPCTypes.FuseStatus,
  }>
) => ({error: false, payload, type: fuseStatusUpdate})
export const createOpenInFileUI = (payload: $ReadOnly<{path?: string}>) => ({error: false, payload, type: openInFileUI})
export const createSortSetting = (
  payload: $ReadOnly<{
    path: Types.Path,
    sortSetting: Types.SortSetting,
  }>
) => ({error: false, payload, type: sortSetting})

// Action Payloads
export type DismissTransferPayload = More.ReturnType<typeof createDismissTransfer>
export type DownloadFinishedPayload = More.ReturnType<typeof createDownloadFinished>
export type DownloadPayload = More.ReturnType<typeof createDownload>
export type DownloadStartedPayload = More.ReturnType<typeof createDownloadStarted>
export type FileTransferProgressPayload = More.ReturnType<typeof createFileTransferProgress>
export type FolderListLoadPayload = More.ReturnType<typeof createFolderListLoad>
export type FolderListLoadedPayload = More.ReturnType<typeof createFolderListLoaded>
export type FuseStatusPayload = More.ReturnType<typeof createFuseStatus>
export type FuseStatusUpdatePayload = More.ReturnType<typeof createFuseStatusUpdate>
export type OpenInFileUIPayload = More.ReturnType<typeof createOpenInFileUI>
export type SortSettingPayload = More.ReturnType<typeof createSortSetting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDismissTransfer>
  | More.ReturnType<typeof createDownload>
  | More.ReturnType<typeof createDownloadFinished>
  | More.ReturnType<typeof createDownloadStarted>
  | More.ReturnType<typeof createFileTransferProgress>
  | More.ReturnType<typeof createFolderListLoad>
  | More.ReturnType<typeof createFolderListLoaded>
  | More.ReturnType<typeof createFuseStatus>
  | More.ReturnType<typeof createFuseStatusUpdate>
  | More.ReturnType<typeof createOpenInFileUI>
  | More.ReturnType<typeof createSortSetting>
  | {type: 'common:resetStore', payload: void}
