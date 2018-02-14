// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const sortSetting = 'fs:sortSetting'

// Action Creators
export const createFolderListLoad = (payload: $ReadOnly<{path: Types.Path}>) => ({error: false, payload, type: folderListLoad})
export const createFolderListLoaded = (payload: $ReadOnly<{pathItems: I.Map<Types.Path, Types.PathItem>}>) => ({error: false, payload, type: folderListLoaded})
export const createSortSetting = (
  payload: $ReadOnly<{
    path: Types.Path,
    sortSetting: Types.SortSetting,
  }>
) => ({error: false, payload, type: sortSetting})

// Action Payloads
export type FolderListLoadPayload = More.ReturnType<typeof createFolderListLoad>
export type FolderListLoadedPayload = More.ReturnType<typeof createFolderListLoaded>
export type SortSettingPayload = More.ReturnType<typeof createSortSetting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createFolderListLoad>
  | More.ReturnType<typeof createFolderListLoaded>
  | More.ReturnType<typeof createSortSetting>
  | {type: 'common:resetStore', payload: void}
