// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const download = 'fs:download'
export const downloadFinished = 'fs:downloadFinished'
export const downloadStarted = 'fs:downloadStarted'
export const fileTransferProgress = 'fs:fileTransferProgress'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const sortSetting = 'fs:sortSetting'

// Action Creators
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
    localPath: string,
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
export const createSortSetting = (
  payload: $ReadOnly<{
    path: Types.Path,
    sortSetting: Types.SortSetting,
  }>
) => ({error: false, payload, type: sortSetting})

// Action Payloads
export type DownloadFinishedPayload = More.ReturnType<typeof createDownloadFinished>
export type DownloadPayload = More.ReturnType<typeof createDownload>
export type DownloadStartedPayload = More.ReturnType<typeof createDownloadStarted>
export type FileTransferProgressPayload = More.ReturnType<typeof createFileTransferProgress>
export type FolderListLoadPayload = More.ReturnType<typeof createFolderListLoad>
export type FolderListLoadedPayload = More.ReturnType<typeof createFolderListLoaded>
export type SortSettingPayload = More.ReturnType<typeof createSortSetting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDownload>
  | More.ReturnType<typeof createDownloadFinished>
  | More.ReturnType<typeof createDownloadStarted>
  | More.ReturnType<typeof createFileTransferProgress>
  | More.ReturnType<typeof createFolderListLoad>
  | More.ReturnType<typeof createFolderListLoaded>
  | More.ReturnType<typeof createSortSetting>
  | {type: 'common:resetStore', payload: void}
