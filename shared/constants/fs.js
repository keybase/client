// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import uuidv1 from 'uuid/v1'
import {globalColors} from '../styles'
export const defaultPath = '/keybase'

export const makeFolder: I.RecordFactory<Types._FolderPathItem> = I.Record({
  name: 'unknown',
  lastModifiedTimestamp: 0,
  size: 0,
  progress: 'pending',
  children: I.List(),
  type: 'folder',
})

export const makeFile: I.RecordFactory<Types._FilePathItem> = I.Record({
  name: 'unknown',
  lastModifiedTimestamp: 0,
  size: 0,
  progress: 'pending',
  type: 'file',
})

export const makeUnknownPathItem: I.RecordFactory<Types._UnknownPathItem> = I.Record({
  name: 'unknown',
  lastModifiedTimestamp: 0,
  size: 0,
  progress: 'pending',
  type: 'unknown',
})

export const makeSortSetting: I.RecordFactory<Types._SortSetting> = I.Record({
  sortBy: 'name',
  sortOrder: 'asc',
})

export const makePathUserSetting: I.RecordFactory<Types._PathUserSetting> = I.Record({
  sort: makeSortSetting(),
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder()]]),
  pathUserSettings: I.Map([[Types.stringToPath('/keybase'), makePathUserSetting()]]),
  loadingPaths: I.Set(),
})

export const makeUUID = () => uuidv1(null, Buffer.alloc(16), 0)
export const fsPathToRpcPathString = (p: Types.Path): string =>
  Types.pathToString(p).substring('/keybase'.length) || '/'

export const sortPathItems = (
  items: I.List<Types.PathItem>,
  sortSetting: Types.SortSetting,
  username?: string
): I.List<Types.PathItem> => items.sort(Types.sortSettingToCompareFunction(sortSetting, username))

const privateColors = {
  iconColor: globalColors.darkBlue2,
  textColor: globalColors.darkBlue,
}

const publicColors = {
  iconColor: globalColors.yellowGreen,
  textColor: globalColors.yellowGreen2,
}

const folderTextType = {
  textType: 'BodySemibold',
}

const fileTextType = {
  textType: 'Body',
}

const itemStylesTeamList = {iconType: 'iconfont-nav-teams', ...privateColors, ...folderTextType}
const itemStylesPublicMe = {iconType: 'iconfont-folder-public-me', ...publicColors, ...folderTextType}
const itemStylesPrivateMe = {iconType: 'iconfont-folder-private-me', ...privateColors, ...folderTextType}
const itemStylesPublicFolder = {iconType: 'iconfont-folder-public', ...publicColors, ...folderTextType}
const itemStylesPublicFile = {iconType: 'iconfont-file-note', ...publicColors, ...fileTextType}
const itemStylesPrivateFolder = {iconType: 'iconfont-folder-private', ...privateColors, ...folderTextType}
const itemStylesPrivateFile = {iconType: 'iconfont-file-note', ...privateColors, ...fileTextType}
const itemStylesPublicUnknown = {iconType: 'iconfont-question-mark', ...publicColors, ...fileTextType}
const itemStylesPrivateUnknown = {iconType: 'iconfont-question-mark', ...privateColors, ...fileTextType}

export const getItemStyles = (
  path: Types.Path,
  type: Types.PathType,
  username?: string
): Types.ItemStyles => {
  if (path === '/keybase/team') {
    return itemStylesTeamList
  } else if (username) {
    if (path === `/keybase/public/${username}`) {
      return itemStylesPublicMe
    } else if (path === `/keybase/private/${username}`) {
      return itemStylesPrivateMe
    }
  }

  // For icon purposes, we are treating team folders as private.
  const isPublic = Types.getPathElements(path)[1] === 'public'

  switch (type) {
    case 'folder':
      return isPublic ? itemStylesPublicFolder : itemStylesPrivateFolder
    case 'file':
      // TODO: different file types
      return isPublic ? itemStylesPublicFile : itemStylesPrivateFile
    case 'symlink':
      return isPublic ? itemStylesPublicFile : itemStylesPrivateFile
    default:
      return isPublic ? itemStylesPublicUnknown : itemStylesPrivateUnknown
  }
}
