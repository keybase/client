// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import * as RPCTypes from './types/rpc-gen'
import {isMobile} from './platform'
import uuidv1 from 'uuid/v1'
import logger from '../logger'
import {globalColors} from '../styles'
import {downloadFilePath, downloadFilePathNoSearch} from '../util/file'
import type {IconType} from '../common-adapters'
import {FolderTypeToString} from '../constants/rpc'
import {tlfToPreferredOrder} from '../util/kbfs'
import {memoize, findKey} from 'lodash-es'

export const defaultPath = '/keybase'

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

export const makeNewFolder: I.RecordFactory<Types._NewFolder> = I.Record({
  type: 'new-folder',
  status: 'editing',
  name: 'New Folder',
  hint: 'New Folder',
  parentPath: Types.stringToPath('/keybase'),
})

export const makeFolder: I.RecordFactory<Types._FolderPathItem> = I.Record({
  badgeCount: 0,
  name: 'unknown',
  lastModifiedTimestamp: 0,
  lastWriter: {uid: '', username: ''},
  size: 0,
  progress: 'pending',
  children: I.Set(),
  favoriteChildren: I.Set(),
  tlfMeta: undefined,
  resetParticipants: [],
  teamID: undefined,
  type: 'folder',
})

export const makeFile: I.RecordFactory<Types._FilePathItem> = I.Record({
  badgeCount: 0,
  name: 'unknown',
  lastModifiedTimestamp: 0,
  lastWriter: {uid: '', username: ''},
  size: 0,
  progress: 'pending',
  type: 'file',
  mimeType: '',
})

export const makeSymlink: I.RecordFactory<Types._SymlinkPathItem> = I.Record({
  badgeCount: 0,
  name: 'unknown',
  lastModifiedTimestamp: 0,
  lastWriter: {uid: '', username: ''},
  size: 0,
  progress: 'pending',
  type: 'symlink',
  linkTarget: '',
})

export const makeUnknownPathItem: I.RecordFactory<Types._UnknownPathItem> = I.Record({
  badgeCount: 0,
  name: 'unknown',
  lastModifiedTimestamp: 0,
  lastWriter: {uid: '', username: ''},
  size: 0,
  progress: 'pending',
  type: 'unknown',
})

export const makeFavoriteItem: I.RecordFactory<Types._FavoriteItem> = I.Record({
  name: 'unknown',
  badgeCount: 0,
  favoriteChildren: I.Set(),
  tlfMeta: undefined,
  teamId: '',
})

export const makeSortSetting: I.RecordFactory<Types._SortSetting> = I.Record({
  sortBy: 'name',
  sortOrder: 'asc',
})

export const makePathUserSetting: I.RecordFactory<Types._PathUserSetting> = I.Record({
  sort: makeSortSetting(),
})

export const makeDownloadMeta: I.RecordFactory<Types._DownloadMeta> = I.Record({
  type: 'download',
  entryType: 'unknown',
  intent: 'none',
  path: Types.stringToPath(''),
  localPath: '',
  opID: null,
})

export const makeDownloadState: I.RecordFactory<Types._DownloadState> = I.Record({
  completePortion: 0,
  endEstimate: undefined,
  error: undefined,
  isDone: false,
  startedAt: 0,
})

export const makeDownload: I.RecordFactory<Types._Download> = I.Record({
  meta: makeDownloadMeta(),
  state: makeDownloadState(),
})

export const makeUpload: I.RecordFactory<Types._Upload> = I.Record({
  writingToJournal: false,
  journalFlushing: false,
  error: undefined,
})

export const makeFlags: I.RecordFactory<Types._Flags> = I.Record({
  kbfsOpening: false,
  kbfsInstalling: false,
  fuseInstalling: false,
  kextPermissionError: false,
  securityPrefsPropmted: false,
  showBanner: false,
  syncing: false,
})

export const makeLocalHTTPServer: I.RecordFactory<Types._LocalHTTPServer> = I.Record({
  address: '',
  token: '',
})

export const makeJournal: I.RecordFactory<Types._Journal> = I.Record({
  totalSyncingBytes: 0,
  endEstimate: undefined,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  flags: makeFlags(),
  fuseStatus: null,
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder()]]),
  edits: I.Map(),
  pathUserSettings: I.Map([[Types.stringToPath('/keybase'), makePathUserSetting()]]),
  loadingPaths: I.Set(),
  downloads: I.Map(),
  uploads: I.Map(),
  journal: makeJournal(),
  localHTTPServerInfo: null,
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
const itemStylesKeybase = {
  iconSpec: makeBasicPathItemIconSpec('iconfont-folder-private', unknownTextColor),
  textColor: unknownTextColor,
  textType: folderTextType,
}

const getIconSpecFromUsernames = (usernames: Array<string>, me?: ?string) => {
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

const itemStylesPublicTlf = memoize((tlf: string, me?: ?string) => ({
  iconSpec: getIconSpecFromUsernames(splitTlfIntoUsernames(tlf), me),
  textColor: publicTextColor,
  textType: folderTextType,
}))
const itemStylesPrivateTlf = memoize((tlf: string, me?: ?string) => ({
  iconSpec: getIconSpecFromUsernames(splitTlfIntoUsernames(tlf), me),
  textColor: privateTextColor,
  textType: folderTextType,
}))
const itemStylesTeamTlf = memoize((teamName: string) => ({
  iconSpec: makeTeamAvatarPathItemIconSpec(teamName),
  textColor: privateTextColor,
  textType: folderTextType,
}))

export const humanReadableFileSize = (size: number) => {
  const kib = 1024
  const mib = kib * kib
  const gib = mib * kib
  const tib = gib * kib

  if (!size) return ''
  if (size >= tib) return `${Math.round(size / tib)} TB`
  if (size >= gib) return `${Math.round(size / gib)} GB`
  if (size >= mib) return `${Math.round(size / mib)} MB`
  if (size >= kib) return `${Math.round(size / kib)} KB`
  return `${size} B`
}

export const getItemStyles = (
  pathElems: Array<string>,
  type: Types.PathType,
  username?: ?string
): Types.ItemStyles => {
  if (pathElems.length === 1 && pathElems[0] === 'keybase') {
    return itemStylesKeybase
  }
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

export const editTypeToPathType = (type: Types.EditType): Types.PathType => {
  switch (type) {
    case 'new-folder':
      return 'folder'
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(type);
      */
      return 'unknown'
  }
}

export const makeDownloadKey = (path: Types.Path, localPath: string) =>
  `download:${Types.pathToString(path)}:${localPath}`
export const makeUploadKey = (localPath: string, path: Types.Path) =>
  `upload:${Types.pathToString(path)}:${localPath}`

export const downloadFilePathFromPath = (p: Types.Path): Promise<Types.LocalPath> =>
  downloadFilePath(Types.getPathName(p))
export const downloadFilePathFromPathNoSearch = (p: Types.Path): string =>
  downloadFilePathNoSearch(Types.getPathName(p))

export type FavoritesListResult = {
  users: {[string]: string},
  devices: {[string]: Types.Device},
  favorites: Array<Types.FavoriteFolder>,
  new: Array<Types.FavoriteFolder>,
  ignored: Array<Types.FavoriteFolder>,
}

// Take the parsed JSON from kbfs/favorite/list, and populate an array of
// Types.FolderRPCWithMeta with the appropriate metadata:
//
// 1) Is this favorite ignored or new?
// 2) Does it need a rekey?
//
const _fillMetadataInFavoritesResult = (
  favoritesResult: FavoritesListResult,
  myKID: any
): Array<Types.FolderRPCWithMeta> => {
  const mapFolderWithMeta = ({isIgnored, isNew}) => (
    folder: Types.FavoriteFolder
  ): Types.FolderRPCWithMeta => {
    if (!folder.problem_set) {
      return {
        ...folder,
        isIgnored,
        isNew,
        needsRekey: false,
      }
    }

    const solutions = folder.problem_set.solution_kids || {}
    const canSelfHelp = folder.problem_set.can_self_help
    const youCanUnlock = canSelfHelp
      ? (solutions[myKID] || []).map(kid => ({...favoritesResult.devices[kid], deviceID: kid}))
      : []

    const waitingForParticipantUnlock = !canSelfHelp
      ? Object.keys(solutions).map(userID => {
          const devices = solutions[userID].map(kid => favoritesResult.devices[kid].name)
          const numDevices = devices.length
          const last = numDevices > 1 ? devices.pop() : null

          return {
            name: favoritesResult.users[userID],
            devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${
              last ? ` or ${last}` : ''
            }.`,
          }
        })
      : []
    return {
      ...folder,
      isIgnored,
      isNew,
      needsRekey: !!Object.keys(solutions).length,
      waitingForParticipantUnlock,
      youCanUnlock,
    }
  }

  return [
    ...favoritesResult.favorites.map(mapFolderWithMeta({isIgnored: false, isNew: false})),
    ...favoritesResult.ignored.map(mapFolderWithMeta({isIgnored: true, isNew: false})),
    ...favoritesResult.new.map(mapFolderWithMeta({isIgnored: false, isNew: true})),
  ]
}

export const folderToFavoriteItems = (
  txt: string = '',
  username: string,
  loggedIn: boolean
): I.Map<Types.Path, Types.FavoriteItem> => {
  let favoritesResult: FavoritesListResult
  let badges = {
    '/keybase/private': 0,
    '/keybase/public': 0,
    '/keybase/team': 0,
  }
  let favoriteChildren = {
    '/keybase/private': new Set(),
    '/keybase/public': new Set(),
    '/keybase/team': new Set(),
  }
  try {
    favoritesResult = JSON.parse(txt)
  } catch (err) {
    logger.warn('Invalid json from getFavorites: ', err)
    return I.Map()
  }

  const myKID = findKey(favoritesResult.users, name => name === username)

  // figure out who can solve the rekey
  const folders: Array<Types.FolderRPCWithMeta> = _fillMetadataInFavoritesResult(favoritesResult, myKID)
  const favoriteFolders = folders.map(
    ({
      name,
      folderType,
      isIgnored,
      isNew,
      needsRekey,
      waitingForParticipantUnlock,
      youCanUnlock,
      team_id,
      reset_members,
    }) => {
      const folderTypeString = FolderTypeToString(folderType)
      const folderParent = `/keybase/${folderTypeString}`
      const preferredName = tlfToPreferredOrder(name, username)
      const folderPathString = `${folderParent}/${preferredName}`
      const folderPath = Types.stringToPath(folderPathString)
      favoriteChildren[folderParent].add(preferredName)
      if (isNew) {
        badges[folderParent] += 1
      }
      return [
        // key
        folderPath,
        // value
        makeFavoriteItem({
          badgeCount: 0,
          name: preferredName,
          tlfMeta: {
            folderType,
            isIgnored,
            isNew,
            needsRekey,
            waitingForParticipantUnlock,
            youCanUnlock,
            teamId: team_id || '',
            resetParticipants: reset_members || [],
          },
        }),
      ]
    }
  )
  return I.Map(
    favoriteFolders.concat(
      Object.keys(badges).map(badgeKey => {
        const badgePath = Types.stringToPath(badgeKey)
        return [
          badgePath,
          makeFavoriteItem({
            badgeCount: badges[badgeKey],
            name: Types.getPathName(badgePath),
            favoriteChildren: I.Set(favoriteChildren[badgeKey]),
          }),
        ]
      })
    )
  )
}

export const viewTypeFromMimeType = (mimeType: string): Types.FileViewType => {
  if (mimeType === 'text/plain') {
    return 'text'
  }
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return 'av'
  }
  if (mimeType === 'application/pdf') {
    return 'pdf'
  }
  return 'default'
}

export const isMedia = (pathItem: Types.PathItem): boolean =>
  pathItem.type === 'file' && ['image', 'av'].includes(viewTypeFromMimeType(pathItem.mimeType))

const slashKeybaseSlashLength = '/keybase/'.length
export const generateFileURL = (path: Types.Path, localHTTPServerInfo: ?Types._LocalHTTPServer): string => {
  if (localHTTPServerInfo === null) {
    return 'about:blank'
  }
  const {address, token} = localHTTPServerInfo || makeLocalHTTPServer() // make flow happy
  // We need to do this because otherwise encodeURIComponent would encode "/"s.
  // If we get a relative redirect (e.g. when requested resource is index.html,
  // we get redirected to "./"), we'd end up redirect to a wrong resource.
  const encoded = encodeURIComponent(Types.pathToString(path).slice(slashKeybaseSlashLength)).replace(
    /%2F/g,
    '/'
  )
  console.log(encoded)

  return `http://${address}/files/${encoded}?token=${token}`
}

export const invalidTokenTitle = 'KBFS HTTP Token Invalid'

export const folderRPCFromPath = (path: Types.Path): ?RPCTypes.Folder => {
  const pathElems = Types.getPathElements(path)
  if (pathElems.length === 0) return null

  const visibility = Types.getVisibilityFromElems(pathElems)
  if (visibility === null) return null
  const isPrivate = visibility === 'private' || visibility === 'team'

  const name = Types.getPathNameFromElems(pathElems)
  if (name === '') return null

  return {
    folderType: Types.getRPCFolderTypeFromVisibility(visibility),
    name,
    private: isPrivate,
    notificationsOn: false,
    created: false,
  }
}

export const showIgnoreFolder = (path: Types.Path, pathItem: Types.PathItem, username?: string): boolean =>
  !!pathItem.tlfMeta &&
  ['public', 'private'].includes(Types.getPathVisibility(path)) &&
  Types.getPathName(path) !== username

export const syntheticEventToTargetRect = (evt?: SyntheticEvent<>): ?ClientRect =>
  isMobile ? null : evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null

// shouldUseOldMimeType determines if mimeType from newItem should reuse
// what's in oldItem.
export const shouldUseOldMimeType = (oldItem: Types.FilePathItem, newItem: Types.FilePathItem): boolean => {
  if (oldItem.mimeType === '' || newItem.mimeType !== '') {
    return false
  }

  return (
    oldItem.type === newItem.type &&
    oldItem.lastModifiedTimestamp === newItem.lastModifiedTimestamp &&
    oldItem.lastWriter.uid === newItem.lastWriter.uid &&
    oldItem.name === newItem.name &&
    oldItem.size === newItem.size
  )
}

export const invalidTokenError = new Error('invalid token')

export const makeEditID = (): Types.EditID => Types.stringToEditID(uuidv1())
