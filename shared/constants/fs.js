// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import * as RPCTypes from './types/rpc-gen'
import * as ChatConstants from './chat2'
import * as FsGen from '../actions/fs-gen'
import * as Flow from '../util/flow'
import {type TypedState} from '../util/container'
import {isLinux, isWindows, isMobile} from './platform'
import uuidv1 from 'uuid/v1'
import logger from '../logger'
import {globalColors} from '../styles'
import {downloadFilePath, downloadFilePathNoSearch} from '../util/file'
import {tlfToPreferredOrder} from '../util/kbfs'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {findKey} from 'lodash-es'

export const defaultPath = Types.stringToPath('/keybase')

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

export const makeNewFolder: I.RecordFactory<Types._NewFolder> = I.Record({
  hint: 'New Folder',
  name: 'New Folder',
  parentPath: Types.stringToPath('/keybase'),
  status: 'editing',
  type: 'new-folder',
})
export const emptyFolder = makeNewFolder()

const pathItemMetadataDefault = {
  badgeCount: 0,
  lastModifiedTimestamp: 0,
  lastWriter: {uid: '', username: ''},
  name: 'unknown',
  size: 0,
  tlfMeta: undefined,
  writable: false,
}

export const makeFolder: I.RecordFactory<Types._FolderPathItem> = I.Record({
  ...pathItemMetadataDefault,
  children: I.Set(),
  progress: 'pending',
  type: 'folder',
})

export const makeMime: I.RecordFactory<Types._Mime> = I.Record({
  displayPreview: false,
  mimeType: '',
})

export const makeFile: I.RecordFactory<Types._FilePathItem> = I.Record({
  ...pathItemMetadataDefault,
  mimeType: null,
  type: 'file',
})

export const makeSymlink: I.RecordFactory<Types._SymlinkPathItem> = I.Record({
  ...pathItemMetadataDefault,
  linkTarget: '',
  type: 'symlink',
})

export const makeUnknownPathItem: I.RecordFactory<Types._UnknownPathItem> = I.Record({
  ...pathItemMetadataDefault,
  type: 'unknown',
})

export const unknownPathItem = makeUnknownPathItem()

export const makeTlf: I.RecordFactory<Types._Tlf> = I.Record({
  isFavorite: false,
  isIgnored: false,
  isNew: false,
  name: '',
  needsRekey: false,
  resetParticipants: I.List(),
  teamId: '',
  tlfType: 'private',
  waitingForParticipantUnlock: I.List(),
  youCanUnlock: I.List(),
})

export const makeSortSetting: I.RecordFactory<Types._SortSetting> = I.Record({
  sortBy: 'name',
  sortOrder: 'asc',
})

export const defaultSortSetting = makeSortSetting({})

export const makePathUserSetting: I.RecordFactory<Types._PathUserSetting> = I.Record({
  sort: makeSortSetting(),
})

export const makeDownloadMeta: I.RecordFactory<Types._DownloadMeta> = I.Record({
  entryType: 'unknown',
  intent: 'none',
  localPath: '',
  opID: null,
  path: Types.stringToPath(''),
  type: 'download',
})

export const makeDownloadState: I.RecordFactory<Types._DownloadState> = I.Record({
  canceled: false,
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

export const makeFlags: I.RecordFactory<Types._Flags> = I.Record({
  fuseInstalling: false,
  kbfsInstalling: false,
  kbfsOpening: false,
  kextPermissionError: false,
  securityPrefsPrompted: false,
  showBanner: true,
  syncing: false,
})

export const makeLocalHTTPServer: I.RecordFactory<Types._LocalHTTPServer> = I.Record({
  address: '',
  token: '',
})

export const makeUploads: I.RecordFactory<Types._Uploads> = I.Record({
  endEstimate: undefined,
  errors: I.Map(),

  syncingPaths: I.Set(),
  totalSyncingBytes: 0,
  writingToJournal: I.Set(),
})

export const makeTlfs: I.RecordFactory<Types._Tlfs> = I.Record({
  private: I.Map(),
  public: I.Map(),
  team: I.Map(),
})

const placeholderAction = FsGen.createPlaceholderAction()

const _makeError: I.RecordFactory<Types._FsError> = I.Record({
  error: 'unknown error',
  erroredAction: placeholderAction,
  retriableAction: undefined,
  time: 0,
})

// Populate `time` with Date.now() if not provided.
export const makeError = (record?: {
  time?: number,
  error: any,
  erroredAction: any,
  retriableAction?: any,
}): I.RecordOf<Types._FsError> => {
  let {time, error, erroredAction, retriableAction} = record || {}
  return _makeError({
    error: !error ? 'unknown error' : error.message || JSON.stringify(error),
    erroredAction,
    retriableAction,
    time: time || Date.now(),
  })
}

export const makeMoveOrCopy: I.RecordFactory<Types._MoveOrCopy> = I.Record({
  destinationParentPath: I.List(),
  sourceItemPath: Types.stringToPath(''),
})

export const makeSendLinkToChat: I.RecordFactory<Types._SendLinkToChat> = I.Record({
  channels: I.Map(),
  convID: ChatConstants.noConversationIDKey,
  path: Types.stringToPath('/keybase'),
})

export const makePathItemActionMenu: I.RecordFactory<Types._PathItemActionMenu> = I.Record({
  downloadKey: null,
  previousView: 'root',
  view: 'root',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  downloads: I.Map(),
  edits: I.Map(),
  errors: I.Map(),
  flags: makeFlags(),
  fuseStatus: null,
  loadingPaths: I.Map(),
  localHTTPServerInfo: null,
  moveOrCopy: makeMoveOrCopy(),
  pathItemActionMenu: makePathItemActionMenu(),
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder()]]),
  pathUserSettings: I.Map([[Types.stringToPath('/keybase'), makePathUserSetting()]]),
  sendLinkToChat: makeSendLinkToChat(),
  tlfUpdates: I.List(),
  tlfs: makeTlfs(),
  uploads: makeUploads(),
})

export const makeUUID = () => uuidv1({}, Buffer.alloc(16), 0)

export const fsPathToRpcPathString = (p: Types.Path): string =>
  Types.pathToString(p).substring('/keybase'.length) || '/'

export const getPathTextColor = (path: Types.Path) => {
  const elems = Types.getPathElements(path)
  return elems.length >= 2 && elems[1] === 'public' ? globalColors.yellowGreen2 : globalColors.black_75
}

export const pathTypeToTextType = (type: Types.PathType) => (type === 'folder' ? 'BodySemibold' : 'Body')

export const splitTlfIntoUsernames = (tlf: string): Array<string> =>
  tlf
    .split(' ')[0]
    .replace(/#/g, ',')
    .split(',')

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

export const editTypeToPathType = (type: Types.EditType): Types.PathType => {
  switch (type) {
    case 'new-folder':
      return 'folder'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return 'unknown'
  }
}

export const makeDownloadKey = (path: Types.Path) => `download:${Types.pathToString(path)}:${makeUUID()}`
export const getDownloadIntentFromAction = (
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
): Types.DownloadIntent =>
  action.type === FsGen.download ? 'none' : action.type === FsGen.shareNative ? 'share' : 'camera-roll'

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
            devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${
              last ? ` or ${last}` : ''
            }.`,
            name: favoritesResult.users[userID],
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

export const createFavoritesLoadedFromJSONResults = (
  txt: string = '',
  username: string,
  loggedIn: boolean
): ?FsGen.FavoritesLoadedPayload => {
  const favoritesResult = ((txt: string): ?FavoritesListResult => {
    try {
      return JSON.parse(txt)
    } catch (err) {
      logger.warn('Invalid json from getFavorites: ', err)
      return null
    }
  })(txt)

  if (!favoritesResult) {
    return null
  }

  // figure out who can solve the rekey
  const myKID = findKey(favoritesResult.users, name => name === username)
  const folders: Array<Types.FolderRPCWithMeta> = _fillMetadataInFavoritesResult(favoritesResult, myKID)

  const tlfs: {
    private: {[string]: Types.Tlf},
    public: {[string]: Types.Tlf},
    team: {[string]: Types.Tlf},
  } = folders.reduce(
    (tlfs, folder) => {
      const {
        name,
        folderType,
        isIgnored,
        isNew,
        needsRekey,
        waitingForParticipantUnlock,
        youCanUnlock,
        team_id,
        reset_members,
      } = folder
      const tlf = makeTlf({
        isFavorite: true,
        isIgnored,
        isNew,
        name: tlfToPreferredOrder(name, username),
        needsRekey,
        resetParticipants: I.List(reset_members || []),
        teamId: team_id || '',
        waitingForParticipantUnlock: I.List(waitingForParticipantUnlock || []),
        youCanUnlock: I.List(youCanUnlock || []),
      })
      if (folderType === RPCTypes.favoriteFolderType.private) {
        tlfs.private[tlf.name] = tlf
      } else if (folderType === RPCTypes.favoriteFolderType.public) {
        tlfs.public[tlf.name] = tlf
      } else if (folderType === RPCTypes.favoriteFolderType.team) {
        tlfs.team[tlf.name] = tlf
      }
      return tlfs
    },
    {private: {}, public: {}, team: {}}
  )

  return FsGen.createFavoritesLoaded({
    private: I.Map(tlfs.private),
    public: I.Map(tlfs.public),
    team: I.Map(tlfs.team),
  })
}

export const makeTlfUpdate: I.RecordFactory<Types._TlfUpdate> = I.Record({
  history: I.List(),
  path: Types.stringToPath(''),
  serverTime: 0,
  writer: '',
})

export const makeTlfEdit: I.RecordFactory<Types._TlfEdit> = I.Record({
  editType: 'unknown',
  filename: '',
  serverTime: 0,
})

const fsNotificationTypeToEditType = (fsNotificationType: number): Types.FileEditType => {
  switch (fsNotificationType) {
    case RPCTypes.kbfsCommonFSNotificationType.fileCreated:
      return 'created'
    case RPCTypes.kbfsCommonFSNotificationType.fileModified:
      return 'modified'
    case RPCTypes.kbfsCommonFSNotificationType.fileDeleted:
      return 'deleted'
    case RPCTypes.kbfsCommonFSNotificationType.fileRenamed:
      return 'renamed'
    default:
      return 'unknown'
  }
}

export const userTlfHistoryRPCToState = (
  history: Array<RPCTypes.FSFolderEditHistory>
): Types.UserTlfUpdates => {
  let updates = []
  history.forEach(folder => {
    const updateServerTime = folder.serverTime
    const path = pathFromFolderRPC(folder.folder)
    const tlfUpdates = folder.history
      ? folder.history.map(({writerName, edits}) =>
          makeTlfUpdate({
            history: I.List(
              edits
                ? edits.map(({filename, notificationType, serverTime}) =>
                    makeTlfEdit({
                      editType: fsNotificationTypeToEditType(notificationType),
                      filename,
                      serverTime,
                    })
                  )
                : []
            ),
            path,
            serverTime: updateServerTime,
            writer: writerName,
          })
        )
      : []
    updates = updates.concat(tlfUpdates)
  })
  return I.List(updates)
}

export const viewTypeFromMimeType = (mime: ?Types.Mime): Types.FileViewType => {
  if (mime && mime.displayPreview) {
    const mimeType = mime.mimeType
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
  }
  return 'default'
}

export const isMedia = (pathItem: Types.PathItem): boolean =>
  pathItem.type === 'file' && ['image', 'av'].includes(viewTypeFromMimeType(pathItem.mimeType))

const slashKeybaseSlashLength = '/keybase/'.length
export const generateFileURL = (
  path: Types.Path,
  localHTTPServerInfo: ?$ReadOnly<Types._LocalHTTPServer>
): string => {
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
    created: false,
    folderType: Types.getRPCFolderTypeFromVisibility(visibility),
    name,
    notificationsOn: false,
    private: isPrivate,
  }
}

export const pathFromFolderRPC = (folder: RPCTypes.Folder): Types.Path => {
  const visibility = Types.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return Types.stringToPath('')
  return Types.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

export const showIgnoreFolder = (path: Types.Path, username?: string): boolean => {
  const elems = Types.getPathElements(path)
  if (elems.length !== 3) {
    return false
  }
  return ['public', 'private'].includes(elems[1]) && elems[2] !== username
}

export const syntheticEventToTargetRect = (evt?: SyntheticEvent<>): ?ClientRect =>
  isMobile ? null : evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null

// shouldUseOldMimeType determines if mimeType from newItem should reuse
// what's in oldItem.
export const shouldUseOldMimeType = (oldItem: Types.FilePathItem, newItem: Types.FilePathItem): boolean => {
  if (!oldItem.mimeType || newItem.mimeType) {
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
export const notFoundError = new Error('not found')

export const makeEditID = (): Types.EditID => Types.stringToEditID(uuidv1())

export const getTlfListFromType = (tlfs: Types.Tlfs, tlfType: Types.TlfType): Types.TlfList => {
  switch (tlfType) {
    case 'private':
      return tlfs.private
    case 'public':
      return tlfs.public
    case 'team':
      return tlfs.team
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(tlfType)
      return I.Map()
  }
}

export const computeBadgeNumberForTlfList = (tlfList: Types.TlfList): number =>
  tlfList.reduce((accumulator, tlf) => (tlfIsBadged(tlf) ? accumulator + 1 : accumulator), 0)

export const computeBadgeNumberForAll = (tlfs: Types.Tlfs): number =>
  ['private', 'public', 'team']
    .map(tlfType => computeBadgeNumberForTlfList(getTlfListFromType(tlfs, tlfType)))
    .reduce((sum, count) => sum + count, 0)

export const getTlfListAndTypeFromPath = (
  tlfs: Types.Tlfs,
  path: Types.Path
): {
  tlfList: Types.TlfList,
  tlfType: Types.TlfType,
} => {
  const visibility = Types.getPathVisibility(path)
  switch (visibility) {
    case 'private':
    case 'public':
    case 'team':
      const tlfType: Types.TlfType = visibility
      return {tlfList: getTlfListFromType(tlfs, tlfType), tlfType}
    default:
      return {tlfList: I.Map(), tlfType: 'private'}
  }
}

export const unknownTlf = makeTlf()
export const getTlfFromPath = (tlfs: Types.Tlfs, path: Types.Path): Types.Tlf => {
  const elems = Types.getPathElements(path)
  if (elems.length !== 3) {
    return unknownTlf
  }
  const {tlfList} = getTlfListAndTypeFromPath(tlfs, path)
  return tlfList.get(elems[2], unknownTlf)
}

export const getTlfFromTlfs = (tlfs: Types.Tlfs, tlfType: Types.TlfType, name: string): Types.Tlf => {
  switch (tlfType) {
    case 'private':
      return tlfs.private.get(name, makeTlf())
    case 'public':
      return tlfs.public.get(name, makeTlf())
    case 'team':
      return tlfs.team.get(name, makeTlf())
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(tlfType)
      return makeTlf()
  }
}

export const tlfTypeAndNameToPath = (tlfType: Types.TlfType, name: string): Types.Path =>
  Types.stringToPath(`/keybase/${tlfType}/${name}`)

export const kbfsEnabled = (state: TypedState) =>
  !isMobile &&
  (isLinux ||
    (!!state.fs.fuseStatus &&
      state.fs.fuseStatus.kextStarted &&
      // on Windows, check that the driver is up to date too
      !(isWindows && state.fs.fuseStatus.installAction === 2)))

export const kbfsOutdated = (state: TypedState) =>
  isWindows && state.fs.fuseStatus && state.fs.fuseStatus.installAction === 2

export const kbfsUninstallString = (state: TypedState) => {
  if (state.fs.fuseStatus && state.fs.fuseStatus.status && state.fs.fuseStatus.status.fields) {
    const field = state.fs.fuseStatus.status.fields.find(element => {
      return element.key === 'uninstallString'
    })
    if (field) {
      return field.value
    }
  }
  return ''
}

export const isPendingDownload = (download: Types.Download, path: Types.Path, intent: Types.DownloadIntent) =>
  download.meta.path === path && download.meta.intent === intent && !download.state.isDone

export const getUploadedPath = (parentPath: Types.Path, localPath: string) =>
  Types.pathConcat(parentPath, Types.getLocalPathName(localPath))

export const usernameInPath = (username: string, path: Types.Path) => {
  const elems = Types.getPathElements(path)
  return elems.length >= 3 && elems[2].split(',').includes(username)
}

// To make sure we have consistent badging, all badging related stuff should go
// through this function. That is:
// * When calculating number of TLFs being badged, a TLF should be counted if
//   and only if this function returns true.
// * When an individual TLF is shown (e.g. as a row), it should be badged if
//   and only if this funciton returns true.
//
// If we add more badges, this function should be updated.
export const tlfIsBadged = (tlf: Types.Tlf) => !tlf.isIgnored && (tlf.isNew || tlf.needsRekey)

export const pathsInSameTlf = (a: Types.Path, b: Types.Path): boolean => {
  const elemsA = Types.getPathElements(a)
  const elemsB = Types.getPathElements(b)
  return elemsA.length >= 3 && elemsB.length >= 3 && elemsA[1] === elemsB[1] && elemsA[2] === elemsB[2]
}

export const destinationPickerGoToPathAction = (
  routePath: I.List<string>,
  destinationParentPath: Types.Path
) => {
  const to = {props: {destinationParentPath}, selected: 'destinationPicker'}
  return RouteTreeGen.createPutActionIfOnPath({
    expectedPath: routePath,
    otherAction: isMobile
      ? RouteTreeGen.createNavigateAppend({path: [to]})
      : RouteTreeGen.createNavigateTo({path: [to]}),
  })
}

export const escapePath = (path: Types.Path): string =>
  Types.pathToString(path).replace(/(\\)|( )/g, (match, p1, p2) => `\\${p1 || p2}`)
export const unescapePath = (escaped: string): Types.Path =>
  // turns "\\" into "\", and "\ " into " "
  Types.stringToPath(escaped.replace(/\\(\\)|\\( )/g, (match, p1, p2) => p1 || p2))

export const parsedPathRoot: Types.ParsedPathRoot = I.Record({kind: 'root'})()
export const parsedPathPrivateList: Types.ParsedPathTlfList = I.Record({
  kind: 'tlf-list',
  tlfType: 'private',
})()
export const parsedPathPublicList: Types.ParsedPathTlfList = I.Record({kind: 'tlf-list', tlfType: 'public'})()
export const parsedPathTeamList: Types.ParsedPathTlfList = I.Record({kind: 'tlf-list', tlfType: 'team'})()

const makeParsedPathGroupTlf: I.RecordFactory<Types._ParsedPathGroupTlf> = I.Record({
  kind: 'group-tlf',
  readers: null,
  tlfType: 'private',
  writers: I.List(),
})

const makeParsedPathTeamTlf: I.RecordFactory<Types._ParsedPathTeamTlf> = I.Record({
  kind: 'team-tlf',
  team: '',
  tlfType: 'team',
})

const makeParsedPathInGroupTlf: I.RecordFactory<Types._ParsedPathInGroupTlf> = I.Record({
  kind: 'in-group-tlf',
  readers: null,
  rest: I.List(),
  tlfType: 'private',
  writers: I.List(),
})

const makeParsedPathInTeamTlf: I.RecordFactory<Types._ParsedPathInTeamTlf> = I.Record({
  kind: 'in-team-tlf',
  rest: I.List(),
  team: '',
  tlfType: 'team',
})

const splitTlfIntoReadersAndWriters = (
  tlf: string
): {|readers: ?I.List<string>, writers: I.List<string>|} => {
  const [w, r] = tlf.split('#')
  return {
    readers: r ? I.List(r.split(',').filter(i => !!i)) : null,
    writers: I.List(w.split(',').filter(i => !!i)),
  }
}

// returns parsedPathRoot if unknown
export const parsePath = (path: Types.Path): Types.ParsedPath => {
  const elems = Types.getPathElements(path)
  if (elems.length <= 1) {
    return parsedPathRoot
  }
  switch (elems[1]) {
    case 'private':
      switch (elems.length) {
        case 2:
          return parsedPathPrivateList
        case 3:
          return makeParsedPathGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            tlfType: 'private',
          })
        default:
          return makeParsedPathInGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            rest: I.List(elems.slice(3)),
            tlfType: 'private',
          })
      }
    case 'public':
      switch (elems.length) {
        case 2:
          return parsedPathPublicList
        case 3:
          return makeParsedPathGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            tlfType: 'public',
          })
        default:
          return makeParsedPathInGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            rest: I.List(elems.slice(3)),
            tlfType: 'public',
          })
      }
    case 'team':
      switch (elems.length) {
        case 2:
          return parsedPathTeamList
        case 3:
          return makeParsedPathTeamTlf({
            team: elems[2],
            tlfType: 'team',
          })
        default:
          return makeParsedPathInTeamTlf({
            rest: I.List(elems.slice(3)),
            team: elems[2],
            tlfType: 'team',
          })
      }
    default:
      return parsedPathRoot
  }
}

export const canSendLinkToChat = (parsedPath: Types.ParsedPath) => {
  switch (parsedPath.kind) {
    case 'root':
    case 'tlf-list':
      return false
    case 'group-tlf':
    case 'team-tlf':
    case 'in-group-tlf':
    case 'in-team-tlf':
      return parsedPath.tlfType !== 'public'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return false
  }
}

export const erroredActionToMessage = (action: FsGen.Actions): string => {
  switch (action.type) {
    case FsGen.favoritesLoad:
      return 'Failed to load TLF lists.'
    case FsGen.filePreviewLoad:
      return `Failed to load file metadata: ${Types.getPathName(action.payload.path)}.`
    case FsGen.folderListLoad:
      return `Failed to list folder: ${Types.getPathName(action.payload.path)}.`
    case FsGen.download:
      return `Failed to download for ${getDownloadIntentFromAction(action)}: ${Types.getPathName(
        action.payload.path
      )}.`
    case FsGen.upload:
      return `Failed to upload: ${Types.getLocalPathName(action.payload.localPath)}.`
    case FsGen.notifySyncActivity:
      return `Failed to gather information about KBFS uploading activities.`
    case FsGen.refreshLocalHTTPServerInfo:
      return 'Failed to get information about internal HTTP server.'
    case FsGen.mimeTypeLoad:
      return `Failed to load mime type: ${Types.pathToString(action.payload.path)}.`
    case FsGen.favoriteIgnore:
      return `Failed to ignore: ${Types.pathToString(action.payload.path)}.`
    case FsGen.openPathInSystemFileManager:
      return `Failed to open path: ${Types.pathToString(action.payload.path)}.`
    case FsGen.openLocalPathInSystemFileManager:
      return `Failed to open path: ${action.payload.localPath}.`
    case FsGen.deleteFile:
      return `Failed to delete file: ${Types.pathToString(action.payload.path)}.`
    case FsGen.move:
      return `Failed to move file(s).`
    case FsGen.copy:
      return `Failed to copy file(s).`
    case FsGen.openPathItem:
      return `Failed to open path: ${Types.pathToString(action.payload.path)}.`
    case FsGen.openPathInFilesTab:
      return `Failed to open path: ${Types.pathToString(action.payload.path)}.`
    default:
      return 'An unexplainable error has occurred.'
  }
}
