// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import uuidv1 from 'uuid/v1'
import {globalColors} from '../styles'
import {downloadFilePath} from '../util/file'
import {type IconType} from '../common-adapters/icon'
import memoize from 'lodash/memoize'

export const defaultPath = '/keybase'

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

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

export const makeTransferState: I.RecordFactory<Types._TransferState> = I.Record({
  type: 'download',
  entryType: 'unknown',
  path: Types.stringToPath(''),
  localPath: '',
  completePortion: 0,
  error: undefined,
  isDone: false,
  startedAt: 0,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder()]]),
  pathUserSettings: I.Map([[Types.stringToPath('/keybase'), makePathUserSetting()]]),
  loadingPaths: I.Set(),
  transfers: I.Map(),
  fuseStatus: null,
  kbfsOpening: false,
  kbfsInstalling: false,
  fuseInstalling: false,
  kextPermissionError: false,
})

const makeBasicPathItemIconSpec = (iconType: IconType, iconColor: string): Types.PathItemIconSpec => ({
  type: 'basic',
  iconType,
  iconColor,
})

const makeTeamAvatarPathItemIconSpec = (teamName: string): Types.PathItemIconSpec => ({
  type: 'teamAvatar',
  teamName,
})

const makeAvatarPathItemIconSpec = (username: string): Types.PathItemIconSpec => ({
  type: 'avatar',
  username,
})

const makeAvatarsPathItemIconSpec = (usernames: Array<string>): Types.PathItemIconSpec => ({
  type: 'avatars',
  usernames,
})

export const makeUUID = () => uuidv1({}, Buffer.alloc(16), 0)
export const fsPathToRpcPathString = (p: Types.Path): string =>
  Types.pathToString(p).substring('/keybase'.length) || '/'

export const sortPathItems = (
  items: I.List<Types.PathItem>,
  sortSetting: Types.SortSetting,
  username?: string
): I.List<Types.PathItem> => items.sort(Types.sortSettingToCompareFunction(sortSetting, username))

const privateIconColor = globalColors.darkBlue2
const privateTextColor = globalColors.darkBlue
const publicIconColor = globalColors.yellowGreen
const publicTextColor = globalColors.yellowGreen2
const unknownTextColor = globalColors.grey

const folderTextType = 'BodySemibold'
const fileTextType = 'Body'

const itemStylesTeamList = {
  iconSpec: makeBasicPathItemIconSpec('icon-folder-team-32', privateIconColor),
  textColor: privateTextColor,
  textType: folderTextType,
}
const itemStylesPublicFolder = {
  iconSpec: makeBasicPathItemIconSpec('icon-folder-public-32', publicIconColor),
  textColor: publicTextColor,
  textType: folderTextType,
}
const itemStylesPublicFile = {
  iconSpec: makeBasicPathItemIconSpec('icon-file-public-32', publicIconColor),
  textColor: publicTextColor,
  textType: fileTextType,
}
const itemStylesPrivateFolder = {
  iconSpec: makeBasicPathItemIconSpec('icon-folder-private-32', privateIconColor),
  textColor: privateTextColor,
  textType: folderTextType,
}
const itemStylesPrivateFile = {
  iconSpec: makeBasicPathItemIconSpec('icon-file-private-32', privateIconColor),
  textColor: privateTextColor,
  textType: fileTextType,
}
const itemStylesPublicUnknown = {
  iconSpec: makeBasicPathItemIconSpec('iconfont-question-mark', unknownTextColor),
  textColor: publicTextColor,
  textType: fileTextType,
}
const itemStylesPrivateUnknown = {
  iconSpec: makeBasicPathItemIconSpec('iconfont-question-mark', unknownTextColor),
  textColor: privateTextColor,
  textType: fileTextType,
}

const getIconSpecFromUsernames = (usernames: Array<string>, me?: string) => {
  if (usernames.length === 1) {
    return makeAvatarPathItemIconSpec(usernames[0])
  } else if (usernames.length > 1) {
    return makeAvatarsPathItemIconSpec(usernames.filter(username => username !== me))
  }
  return makeBasicPathItemIconSpec('iconfont-question-mark', unknownTextColor)
}
const splitTlfIntoUsernames = (tlf: string): Array<string> =>
  tlf
    .split(' ')[0]
    .replace(/#/g, ',')
    .split(',')

const itemStylesPublicTlf = memoize((tlf: string, me?: string) => ({
  iconSpec: getIconSpecFromUsernames(splitTlfIntoUsernames(tlf), me),
  textColor: publicTextColor,
  textType: folderTextType,
}))
const itemStylesPrivateTlf = memoize((tlf: string, me?: string) => ({
  iconSpec: getIconSpecFromUsernames(splitTlfIntoUsernames(tlf), me),
  textColor: privateTextColor,
  textType: folderTextType,
}))
const itemStylesTeamTlf = memoize((teamName: string) => ({
  iconSpec: makeTeamAvatarPathItemIconSpec(teamName),
  textColor: privateTextColor,
  textType: folderTextType,
}))

export const getItemStyles = (
  pathElems: Array<string>,
  type: Types.PathType,
  username?: string
): Types.ItemStyles => {
  // For /keybase/team, the icon is different from directories inside a TLF.
  if (pathElems.length === 2 && pathElems[1] === 'team') {
    return itemStylesTeamList
  }

  if (pathElems.length === 3) {
    switch (pathElems[1]) {
      case 'public':
        return itemStylesPublicTlf(pathElems[2], username)
      case 'private':
        return itemStylesPrivateTlf(pathElems[2], username)
      case 'team':
        return itemStylesTeamTlf(pathElems[2])
      default:
        return itemStylesPrivateUnknown
    }
  }

  // For icon purposes, we are treating team folders as private.
  const isPublic = pathElems[1] === 'public'

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

export const makeDownloadKey = (path: Types.Path, localPath: string) =>
  `download:${Types.pathToString(path)}:${localPath}`

export const downloadFilePathFromPath = (p: Types.Path): Promise<Types.LocalPath> =>
  downloadFilePath(Types.getPathName(p))
