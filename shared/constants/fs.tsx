import * as I from 'immutable'
import * as Types from './types/fs'
import * as RPCTypes from './types/rpc-gen'
import * as ChatConstants from './chat2'
import * as FsGen from '../actions/fs-gen'
import * as Flow from '../util/flow'
import * as Tabs from './tabs'
import * as SettingsConstants from './settings'
import {TypedState} from '../util/container'
import {isLinux, isMobile} from './platform'
import uuidv1 from 'uuid/v1'
import {downloadFilePath, downloadFilePathNoSearch} from '../util/file'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {TypedActions} from '../actions/typed-actions-gen'
import flags from '../util/feature-flags'

export const syncToggleWaitingKey = 'fs:syncToggle'
export const sendLinkToChatFindConversationWaitingKey = 'fs:sendLinkToChatFindConversation'
export const sendLinkToChatSendWaitingKey = 'fs:sendLinkToChatSend'

export const defaultPath = Types.stringToPath('/keybase')

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

export const makeNewFolder: I.Record.Factory<Types._NewFolder> = I.Record({
  hint: 'New Folder',
  name: 'New Folder',
  parentPath: Types.stringToPath('/keybase'),
  status: Types.EditStatusType.Editing,
  type: Types.EditType.NewFolder,
} as Types._NewFolder)
export const emptyFolder = makeNewFolder()

const makePrefetchNotStarted: I.Record.Factory<Types._PrefetchNotStarted> = I.Record({
  state: Types.PrefetchState.NotStarted,
} as Types._PrefetchNotStarted)
export const prefetchNotStarted: Types.PrefetchNotStarted = makePrefetchNotStarted()

const makePrefetchComplete: I.Record.Factory<Types._PrefetchComplete> = I.Record({
  state: Types.PrefetchState.Complete as Types.PrefetchState,
} as Types._PrefetchComplete)
export const prefetchComplete: Types.PrefetchComplete = makePrefetchComplete()

export const makePrefetchInProgress: I.Record.Factory<Types._PrefetchInProgress> = I.Record({
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: Types.PrefetchState.InProgress as Types.PrefetchState,
} as Types._PrefetchInProgress)

const pathItemMetadataDefault = {
  lastModifiedTimestamp: 0,
  lastWriter: '',
  name: 'unknown',
  prefetchStatus: prefetchNotStarted,
  size: 0,
  writable: false,
}

export const makeFolder: I.Record.Factory<Types._FolderPathItem> = I.Record({
  ...pathItemMetadataDefault,
  children: I.Set(),
  progress: Types.ProgressType.Pending as Types.ProgressType,
  type: Types.PathType.Folder as Types.PathType,
} as Types._FolderPathItem)

export const makeMime: I.Record.Factory<Types._Mime> = I.Record({
  displayPreview: false,
  mimeType: '',
} as Types._Mime)

export const makeFile: I.Record.Factory<Types._FilePathItem> = I.Record({
  ...pathItemMetadataDefault,
  mimeType: null,
  type: Types.PathType.File,
} as Types._FilePathItem)

export const makeSymlink: I.Record.Factory<Types._SymlinkPathItem> = I.Record({
  ...pathItemMetadataDefault,
  linkTarget: '',
  type: Types.PathType.Symlink,
} as Types._SymlinkPathItem)

export const makeUnknownPathItem: I.Record.Factory<Types._UnknownPathItem> = I.Record({
  ...pathItemMetadataDefault,
  type: Types.PathType.Unknown,
} as Types._UnknownPathItem)

export const unknownPathItem = makeUnknownPathItem()

const makeTlfSyncEnabled: I.Record.Factory<Types._TlfSyncEnabled> = I.Record({
  mode: Types.TlfSyncMode.Enabled,
})
export const tlfSyncEnabled: Types.TlfSyncEnabled = makeTlfSyncEnabled()

const makeTlfSyncDisabled: I.Record.Factory<Types._TlfSyncDisabled> = I.Record({
  mode: Types.TlfSyncMode.Disabled,
})
export const tlfSyncDisabled: Types.TlfSyncDisabled = makeTlfSyncDisabled()

export const makeTlfSyncPartial: I.Record.Factory<Types._TlfSyncPartial> = I.Record({
  enabledPaths: I.List(),
  mode: Types.TlfSyncMode.Partial,
})

export const makeTlfConflict: I.Record.Factory<Types._TlfConflict> = I.Record({
  branch: '',
  state: Types.ConflictState.None,
} as Types._TlfConflict)

export const makeTlf: I.Record.Factory<Types._Tlf> = I.Record({
  conflict: makeTlfConflict(),
  isFavorite: false,
  isIgnored: false,
  isNew: false,
  name: '',
  resetParticipants: I.List(),
  syncConfig: null,
  teamId: '',
  tlfMtime: 0,
  /* See comment in constants/types/fs.js
  needsRekey: false,
  waitingForParticipantUnlock: I.List(),
  youCanUnlock: I.List(),
  */
} as Types._Tlf)

export const makeSyncingFoldersProgress: I.Record.Factory<Types._SyncingFoldersProgress> = I.Record({
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  start: 0,
} as Types._SyncingFoldersProgress)

export const makeOverallSyncStatus: I.Record.Factory<Types._OverallSyncStatus> = I.Record({
  diskSpaceBannerHidden: false,
  diskSpaceStatus: Types.DiskSpaceStatus.Ok,
  syncingFoldersProgress: makeSyncingFoldersProgress(),
} as Types._OverallSyncStatus)

export const makePathUserSetting: I.Record.Factory<Types._PathUserSetting> = I.Record({
  sort: Types.SortSetting.NameAsc,
} as Types._PathUserSetting)

export const defaultPathUserSetting = makePathUserSetting({
  sort: Types.SortSetting.NameAsc,
})

export const defaultTlfListPathUserSetting = makePathUserSetting({
  sort: Types.SortSetting.TimeAsc,
})

export const makeDownloadMeta: I.Record.Factory<Types._DownloadMeta> = I.Record({
  entryType: Types.PathType.Unknown,
  intent: Types.DownloadIntent.None,
  localPath: '',
  opID: null,
  path: Types.stringToPath(''),
} as Types._DownloadMeta)

export const makeDownloadState: I.Record.Factory<Types._DownloadState> = I.Record({
  canceled: false,
  completePortion: 0,
  endEstimate: undefined,
  error: undefined,
  isDone: false,
  startedAt: 0,
} as Types._DownloadState)

export const makeDownload: I.Record.Factory<Types._Download> = I.Record({
  meta: makeDownloadMeta(),
  state: makeDownloadState(),
} as Types._Download)

export const makeLocalHTTPServer: I.Record.Factory<Types._LocalHTTPServer> = I.Record({
  address: '',
  token: '',
} as Types._LocalHTTPServer)

export const makeUploads: I.Record.Factory<Types._Uploads> = I.Record({
  endEstimate: undefined,
  errors: I.Map(),

  syncingPaths: I.Set(),
  totalSyncingBytes: 0,
  writingToJournal: I.Set(),
} as Types._Uploads)

export const makeTlfs: I.Record.Factory<Types._Tlfs> = I.Record({
  private: I.Map(),
  public: I.Map(),
  team: I.Map(),
} as Types._Tlfs)

const placeholderAction = FsGen.createPlaceholderAction()

const _makeError: I.Record.Factory<Types._FsError> = I.Record({
  errorMessage: 'unknown error',
  erroredAction: placeholderAction,
  retriableAction: undefined,
  time: 0,
} as Types._FsError)

type _MakeErrorArgs = {
  time?: number
  error: any
  erroredAction: FsGen.Actions
  retriableAction?: FsGen.Actions
}
export const makeError = (args?: _MakeErrorArgs): I.RecordOf<Types._FsError> => {
  // TS Issue: https://github.com/microsoft/TypeScript/issues/26235
  let {time, error, erroredAction, retriableAction} = (args || {}) as Partial<NonNullable<_MakeErrorArgs>>
  return _makeError({
    errorMessage: !error ? 'unknown error' : error.message || JSON.stringify(error),
    erroredAction,
    retriableAction,
    time: time || Date.now(),
  })
}

export const makeMoveOrCopySource: I.Record.Factory<Types._MoveOrCopySource> = I.Record({
  path: Types.stringToPath(''),
  type: Types.DestinationPickerSource.MoveOrCopy,
} as Types._MoveOrCopySource)

export const makeIncomingShareSource: I.Record.Factory<Types._IncomingShareSource> = I.Record({
  localPath: Types.stringToLocalPath(''),
  type: Types.DestinationPickerSource.IncomingShare,
} as Types._IncomingShareSource)

export const makeNoSource: I.Record.Factory<Types._NoSource> = I.Record({
  type: Types.DestinationPickerSource.None,
} as Types._NoSource)

export const makeDestinationPicker: I.Record.Factory<Types._DestinationPicker> = I.Record({
  destinationParentPath: I.List(),
  source: makeNoSource(),
} as Types._DestinationPicker)

export const makeSendAttachmentToChat: I.Record.Factory<Types._SendAttachmentToChat> = I.Record({
  convID: ChatConstants.noConversationIDKey,
  filter: '',
  path: Types.stringToPath('/keybase'),
  state: Types.SendAttachmentToChatState.None,
} as Types._SendAttachmentToChat)

export const makeSendLinkToChat: I.Record.Factory<Types._SendLinkToChat> = I.Record({
  channels: I.Map(),
  convID: ChatConstants.noConversationIDKey,
  path: Types.stringToPath('/keybase'),
  state: Types.SendLinkToChatState.None,
} as Types._SendLinkToChat)

export const makePathItemActionMenu: I.Record.Factory<Types._PathItemActionMenu> = I.Record({
  downloadKey: null,
  previousView: Types.PathItemActionMenuView.Root,
  view: Types.PathItemActionMenuView.Root,
} as Types._PathItemActionMenu)

export const makeDriverStatusUnknown: I.Record.Factory<Types._DriverStatusUnknown> = I.Record({
  type: Types.DriverStatusType.Unknown,
} as Types._DriverStatusUnknown)

export const makeDriverStatusEnabled: I.Record.Factory<Types._DriverStatusEnabled> = I.Record({
  dokanOutdated: false,
  dokanUninstallExecPath: null,
  isDisabling: false,
  isNew: false,
  type: Types.DriverStatusType.Enabled,
} as Types._DriverStatusEnabled)

export const makeDriverStatusDisabled: I.Record.Factory<Types._DriverStatusDisabled> = I.Record({
  isDismissed: false,
  isEnabling: false,
  kextPermissionError: false,
  type: Types.DriverStatusType.Disabled,
} as Types._DriverStatusDisabled)

export const defaultDriverStatus = isLinux ? makeDriverStatusEnabled() : makeDriverStatusUnknown()

export const makeSystemFileManagerIntegration: I.Record.Factory<
  Types._SystemFileManagerIntegration
> = I.Record({
  driverStatus: defaultDriverStatus,
  showingBanner: false,
} as Types._SystemFileManagerIntegration)

export const makeKbfsDaemonStatus: I.Record.Factory<Types._KbfsDaemonStatus> = I.Record({
  online: false,
  rpcStatus: Types.KbfsDaemonRpcStatus.Unknown,
} as Types._KbfsDaemonStatus)

export const makeSoftErrors: I.Record.Factory<Types._SoftErrors> = I.Record({
  pathErrors: I.Map(),
  tlfErrors: I.Map(),
} as Types._SoftErrors)

export const makeSettings: I.Record.Factory<Types._Settings> = I.Record({
  isLoading: false,
  spaceAvailableNotificationThreshold: 0,
} as Types._Settings)

export const makeState: I.Record.Factory<Types._State> = I.Record({
  destinationPicker: makeDestinationPicker(),
  downloads: I.Map(),
  edits: I.Map(),
  errors: I.Map(),
  folderViewFilter: '',
  kbfsDaemonStatus: makeKbfsDaemonStatus(),
  lastPublicBannerClosedTlf: '',
  loadingPaths: I.Map(),
  localHTTPServerInfo: makeLocalHTTPServer(),
  overallSyncStatus: makeOverallSyncStatus(),
  pathItemActionMenu: makePathItemActionMenu(),
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder()]]),
  pathUserSettings: I.Map(),
  sendAttachmentToChat: makeSendAttachmentToChat(),
  sendLinkToChat: makeSendLinkToChat(),
  settings: makeSettings(),
  sfmi: makeSystemFileManagerIntegration(),
  softErrors: makeSoftErrors(),
  tlfUpdates: I.List(),
  tlfs: makeTlfs(),
  uploads: makeUploads(),
} as Types._State)

// RPC expects a string that's interpreted as [16]byte on Go side.
export const makeUUID = () => uuidv1({}, Buffer.alloc(16), 0).toString()

export const pathToRPCPath = (path: Types.Path): RPCTypes.Path => ({
  PathType: RPCTypes.PathType.kbfs,
  kbfs: Types.pathToString(path).substring('/keybase'.length) || '/',
})

export const pathTypeToTextType = (type: Types.PathType) =>
  type === Types.PathType.Folder ? 'BodySemibold' : 'Body'

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
    case Types.EditType.NewFolder:
      return Types.PathType.Folder
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return Types.PathType.Unknown
  }
}

export const makeDownloadKey = (path: Types.Path) => `download:${Types.pathToString(path)}:${makeUUID()}`
export const getDownloadIntentFromAction = (
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
): Types.DownloadIntent =>
  action.type === FsGen.download
    ? Types.DownloadIntent.None
    : action.type === FsGen.shareNative
    ? Types.DownloadIntent.Share
    : Types.DownloadIntent.CameraRoll

export const downloadFilePathFromPath = (p: Types.Path): Promise<Types.LocalPath> =>
  downloadFilePath(Types.getPathName(p))
export const downloadFilePathFromPathNoSearch = (p: Types.Path): string =>
  downloadFilePathNoSearch(Types.getPathName(p))

export const makeTlfUpdate: I.Record.Factory<Types._TlfUpdate> = I.Record({
  history: I.List(),
  path: Types.stringToPath(''),
  serverTime: 0,
  writer: '',
})

export const makeTlfEdit: I.Record.Factory<Types._TlfEdit> = I.Record({
  editType: Types.FileEditType.Unknown,
  filename: '',
  serverTime: 0,
} as Types._TlfEdit)

const fsNotificationTypeToEditType = (fsNotificationType: number): Types.FileEditType => {
  switch (fsNotificationType) {
    case RPCTypes.FSNotificationType.fileCreated:
      return Types.FileEditType.Created
    case RPCTypes.FSNotificationType.fileModified:
      return Types.FileEditType.Modified
    case RPCTypes.FSNotificationType.fileDeleted:
      return Types.FileEditType.Deleted
    case RPCTypes.FSNotificationType.fileRenamed:
      return Types.FileEditType.Renamed
    default:
      return Types.FileEditType.Unknown
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

const supportedImgMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
export const viewTypeFromMimeType = (mime: Types.Mime | null): Types.FileViewType => {
  if (mime && mime.displayPreview) {
    const mimeType = mime.mimeType
    if (mimeType === 'text/plain') {
      return Types.FileViewType.Text
    }
    if (supportedImgMimeTypes.has(mimeType)) {
      return Types.FileViewType.Image
    }
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      return Types.FileViewType.Av
    }
    if (mimeType === 'application/pdf') {
      return Types.FileViewType.Pdf
    }
  }
  return Types.FileViewType.Default
}

export const canSaveMedia = (pathItem: Types.PathItem): boolean => {
  if (pathItem.type !== Types.PathType.File || !pathItem.mimeType) {
    return false
  }
  const mime = pathItem.mimeType
  return (
    viewTypeFromMimeType(mime) === Types.FileViewType.Image ||
    // Can't rely on viewType === av here because audios can't be saved to
    // the camera roll.
    mime.mimeType.startsWith('video/')
  )
}

const encodePathForURL = (path: Types.Path) =>
  encodeURIComponent(Types.pathToString(path).slice(slashKeybaseSlashLength))
    .replace(
      // We need to do this because otherwise encodeURIComponent would encode
      // "/"s.  If we get a relative redirect (e.g. when requested resource is
      // index.html, we get redirected to "./"), we'd end up redirect to a wrong
      // resource.
      /%2F/g,
      '/'
    )
    // Additional characters that encodeURIComponent doesn't escape
    .replace(
      /[-_.!~*'()]/g,
      old =>
        `%${old
          .charCodeAt(0)
          .toString(16)
          .toUpperCase()}`
    )

const slashKeybaseSlashLength = '/keybase/'.length
export const generateFileURL = (path: Types.Path, localHTTPServerInfo: Types.LocalHTTPServer): string => {
  const {address, token} = localHTTPServerInfo
  if (!address || !token) {
    return 'about:blank'
  }
  const encoded = encodePathForURL(path)
  return `http://${address}/files/${encoded}?token=${token}`
}

export const invalidTokenTitle = 'KBFS HTTP Token Invalid'

export const folderRPCFromPath = (path: Types.Path): RPCTypes.FolderHandle | null => {
  const pathElems = Types.getPathElements(path)
  if (pathElems.length === 0) return null

  const visibility = Types.getVisibilityFromElems(pathElems)
  if (visibility === null) return null

  const name = Types.getPathNameFromElems(pathElems)
  if (name === '') return null

  return {
    created: false,
    folderType: Types.getRPCFolderTypeFromVisibility(visibility),
    name,
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

export const syntheticEventToTargetRect = (evt?: React.SyntheticEvent): ClientRect | null =>
  isMobile ? null : evt ? (evt.target as HTMLElement).getBoundingClientRect() : null

export const invalidTokenError = new Error('invalid token')
export const notFoundError = new Error('not found')

export const makeEditID = (): Types.EditID => Types.stringToEditID(uuidv1())

export const getTlfListFromType = (tlfs: Types.Tlfs, tlfType: Types.TlfType): Types.TlfList => {
  switch (tlfType) {
    case Types.TlfType.Private:
      return tlfs.private
    case Types.TlfType.Public:
      return tlfs.public
    case Types.TlfType.Team:
      return tlfs.team
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(tlfType)
      return I.Map()
  }
}

export const computeBadgeNumberForTlfList = (tlfList: Types.TlfList): number =>
  tlfList.reduce((accumulator, tlf) => (tlfIsBadged(tlf) ? accumulator + 1 : accumulator), 0)

export const computeBadgeNumberForAll = (tlfs: Types.Tlfs): number =>
  [Types.TlfType.Private, Types.TlfType.Public, Types.TlfType.Team]
    .map(tlfType => computeBadgeNumberForTlfList(getTlfListFromType(tlfs, tlfType)))
    .reduce((sum, count) => sum + count, 0)

export const getTlfListAndTypeFromPath = (
  tlfs: Types.Tlfs,
  path: Types.Path
): {
  tlfList: Types.TlfList
  tlfType: Types.TlfType
} => {
  const visibility = Types.getPathVisibility(path)
  switch (visibility) {
    case Types.TlfType.Private:
    case Types.TlfType.Public:
    case Types.TlfType.Team:
      const tlfType: Types.TlfType = visibility
      return {tlfList: getTlfListFromType(tlfs, tlfType), tlfType}
    default:
      return {tlfList: I.Map(), tlfType: Types.TlfType.Private}
  }
}

export const unknownTlf = makeTlf()
export const getTlfFromPath = (tlfs: Types.Tlfs, path: Types.Path): Types.Tlf => {
  const elems = Types.getPathElements(path)
  if (elems.length < 3) {
    return unknownTlf
  }
  const {tlfList} = getTlfListAndTypeFromPath(tlfs, path)
  return tlfList.get(elems[2], unknownTlf)
}

export const getTlfFromTlfs = (tlfs: Types.Tlfs, tlfType: Types.TlfType, name: string): Types.Tlf => {
  switch (tlfType) {
    case Types.TlfType.Private:
      return tlfs.private.get(name, makeTlf())
    case Types.TlfType.Public:
      return tlfs.public.get(name, makeTlf())
    case Types.TlfType.Team:
      return tlfs.team.get(name, makeTlf())
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(tlfType)
      return makeTlf()
  }
}

export const tlfTypeAndNameToPath = (tlfType: Types.TlfType, name: string): Types.Path =>
  Types.stringToPath(`/keybase/${tlfType}/${name}`)

export const resetBannerType = (state: TypedState, path: Types.Path): Types.ResetBannerType => {
  const resetParticipants = getTlfFromPath(state.fs.tlfs, path).resetParticipants
  if (resetParticipants.size === 0) {
    return Types.ResetBannerNoOthersType.None
  }
  if (resetParticipants.findIndex(username => username === state.config.username) >= 0) {
    return Types.ResetBannerNoOthersType.Self
  }
  return resetParticipants.size
}

export const isPendingDownload = (download: Types.Download, path: Types.Path, intent: Types.DownloadIntent) =>
  download.meta.path === path && download.meta.intent === intent && !download.state.isDone

export const getUploadedPath = (parentPath: Types.Path, localPath: string) =>
  Types.pathConcat(parentPath, Types.getLocalPathName(localPath))

export const usernameInPath = (username: string, path: Types.Path) => {
  const elems = Types.getPathElements(path)
  return elems.length >= 3 && elems[2].split(',').includes(username)
}

export const getUsernamesFromTlfName = (tlfName: string): I.List<string> => {
  const split = splitTlfIntoReadersAndWriters(tlfName)
  return split.writers.concat(split.readers || I.List([]))
}

export const isOfflineUnsynced = (
  daemonStatus: Types.KbfsDaemonStatus,
  pathItem: Types.PathItem,
  path: Types.Path
) =>
  flags.kbfsOfflineMode &&
  !daemonStatus.online &&
  Types.getPathLevel(path) > 2 &&
  pathItem.prefetchStatus !== prefetchComplete

// To make sure we have consistent badging, all badging related stuff should go
// through this function. That is:
// * When calculating number of TLFs being badged, a TLF should be counted if
//   and only if this function returns true.
// * When an individual TLF is shown (e.g. as a row), it should be badged if
//   and only if this funciton returns true.
//
// If we add more badges, this function should be updated.
export const tlfIsBadged = (tlf: Types.Tlf) => !tlf.isIgnored && tlf.isNew

export const pathsInSameTlf = (a: Types.Path, b: Types.Path): boolean => {
  const elemsA = Types.getPathElements(a)
  const elemsB = Types.getPathElements(b)
  return elemsA.length >= 3 && elemsB.length >= 3 && elemsA[1] === elemsB[1] && elemsA[2] === elemsB[2]
}

export const escapePath = (path: Types.Path): string =>
  Types.pathToString(path).replace(/(\\)|( )/g, (match, p1, p2) => `\\${p1 || p2}`)
export const unescapePath = (escaped: string): Types.Path =>
  Types.stringToPath(escaped.replace(/\\(\\)|\\( )/g, (match, p1, p2) => p1 || p2)) // turns "\\" into "\", and "\ " into " "

const makeParsedPathRoot: I.Record.Factory<Types._ParsedPathRoot> = I.Record({kind: Types.PathKind.Root})
export const parsedPathRoot: Types.ParsedPathRoot = makeParsedPathRoot()

const makeParsedPathTlfList: I.Record.Factory<Types._ParsedPathTlfList> = I.Record({
  kind: Types.PathKind.TlfList,
  tlfType: Types.TlfType.Private,
} as Types._ParsedPathTlfList)
export const parsedPathPrivateList: Types.ParsedPathTlfList = makeParsedPathTlfList()
export const parsedPathPublicList: Types.ParsedPathTlfList = makeParsedPathTlfList({
  tlfType: Types.TlfType.Public,
})
export const parsedPathTeamList: Types.ParsedPathTlfList = makeParsedPathTlfList({
  tlfType: Types.TlfType.Team,
})

const makeParsedPathGroupTlf: I.Record.Factory<Types._ParsedPathGroupTlf> = I.Record({
  kind: Types.PathKind.GroupTlf,
  readers: null,
  tlfName: '',
  tlfType: Types.TlfType.Private,
  writers: I.List(),
} as Types._ParsedPathGroupTlf)

const makeParsedPathTeamTlf: I.Record.Factory<Types._ParsedPathTeamTlf> = I.Record({
  kind: Types.PathKind.TeamTlf,
  team: '',
  tlfName: '',
  tlfType: Types.TlfType.Team,
} as Types._ParsedPathTeamTlf)

const makeParsedPathInGroupTlf: I.Record.Factory<Types._ParsedPathInGroupTlf> = I.Record({
  kind: Types.PathKind.InGroupTlf,
  readers: null,
  rest: I.List(),
  tlfName: '',
  tlfType: Types.TlfType.Private,
  writers: I.List(),
} as Types._ParsedPathInGroupTlf)

const makeParsedPathInTeamTlf: I.Record.Factory<Types._ParsedPathInTeamTlf> = I.Record({
  kind: Types.PathKind.InTeamTlf,
  rest: I.List(),
  team: '',
  tlfName: '',
  tlfType: Types.TlfType.Team,
} as Types._ParsedPathInTeamTlf)

const splitTlfIntoReadersAndWriters = (
  tlf: string
): {
  readers: I.List<string> | null
  writers: I.List<string>
} => {
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
            tlfName: elems[2],
            tlfType: Types.TlfType.Private,
          })
        default:
          return makeParsedPathInGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            rest: I.List(elems.slice(3)),
            tlfName: elems[2],
            tlfType: Types.TlfType.Private,
          })
      }
    case 'public':
      switch (elems.length) {
        case 2:
          return parsedPathPublicList
        case 3:
          return makeParsedPathGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            tlfName: elems[2],
            tlfType: Types.TlfType.Public,
          })
        default:
          return makeParsedPathInGroupTlf({
            ...splitTlfIntoReadersAndWriters(elems[2]),
            rest: I.List(elems.slice(3)),
            tlfName: elems[2],
            tlfType: Types.TlfType.Public,
          })
      }
    case 'team':
      switch (elems.length) {
        case 2:
          return parsedPathTeamList
        case 3:
          return makeParsedPathTeamTlf({
            team: elems[2],
            tlfName: elems[2],
            tlfType: Types.TlfType.Team,
          })
        default:
          return makeParsedPathInTeamTlf({
            rest: I.List(elems.slice(3)),
            team: elems[2],
            tlfName: elems[2],
            tlfType: Types.TlfType.Team,
          })
      }
    default:
      return parsedPathRoot
  }
}

export const canSendLinkToChat = (parsedPath: Types.ParsedPath) => {
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
    case Types.PathKind.TlfList:
      return false
    case Types.PathKind.GroupTlf:
    case Types.PathKind.TeamTlf:
      return false
    case Types.PathKind.InGroupTlf:
    case Types.PathKind.InTeamTlf:
      return parsedPath.tlfType !== Types.TlfType.Public
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return false
  }
}

export const canChat = (path: Types.Path) => {
  const parsedPath = parsePath(path)
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
    case Types.PathKind.TlfList:
      return false
    case Types.PathKind.GroupTlf:
    case Types.PathKind.TeamTlf:
      return true
    case Types.PathKind.InGroupTlf:
    case Types.PathKind.InTeamTlf:
      return true
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return false
  }
}

export const isTeamPath = (path: Types.Path): boolean => {
  const parsedPath = parsePath(path)
  return parsedPath.kind !== Types.PathKind.Root && parsedPath.tlfType === Types.TlfType.Team
}

export const getChatTarget = (path: Types.Path, me: string): string => {
  const parsedPath = parsePath(path)
  if (parsedPath.kind !== Types.PathKind.Root && parsedPath.tlfType === Types.TlfType.Team) {
    return 'team conversation'
  }
  if (parsedPath.kind === Types.PathKind.GroupTlf || parsedPath.kind === Types.PathKind.InGroupTlf) {
    if (parsedPath.writers.size === 1 && !parsedPath.readers && parsedPath.writers.first() === me) {
      return 'yourself'
    }
    if (parsedPath.writers.size + (parsedPath.readers ? parsedPath.readers.size : 0) === 2) {
      const notMe = parsedPath.writers.concat(parsedPath.readers || []).filter(u => u !== me)
      if (notMe.size === 1) {
        return notMe.first()
      }
    }
    return 'group conversation'
  }
  return 'conversation'
}

const humanizeDownloadIntent = (intent: Types.DownloadIntent) => {
  switch (intent) {
    case Types.DownloadIntent.CameraRoll:
      return 'save'
    case Types.DownloadIntent.Share:
      return 'prepare to share'
    case Types.DownloadIntent.None:
      return 'download'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
      return ''
  }
}

export const getDestinationPickerPathName = (picker: Types.DestinationPicker): string =>
  picker.source.type === Types.DestinationPickerSource.MoveOrCopy
    ? Types.getPathName(picker.source.path)
    : picker.source.type === Types.DestinationPickerSource.IncomingShare
    ? Types.getLocalPathName(picker.source.localPath)
    : ''

const isPathEnabledForSync = (syncConfig: Types.TlfSyncConfig, path: Types.Path): boolean => {
  switch (syncConfig.mode) {
    case Types.TlfSyncMode.Disabled:
      return false
    case Types.TlfSyncMode.Enabled:
      return true
    case Types.TlfSyncMode.Partial:
      // TODO: when we enable partial sync lookup, remember to deal with
      // potential ".." traversal as well.
      return syncConfig.enabledPaths.includes(path)
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(syncConfig)
      return false
  }
}

export const getSyncStatusInMergeProps = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  tlf: Types.Tlf,
  pathItem: Types.PathItem,
  uploadingPaths: I.Set<Types.Path>,
  path: Types.Path
): Types.SyncStatus => {
  if (
    !tlf.syncConfig ||
    (pathItem === unknownPathItem && tlf.syncConfig.mode !== Types.TlfSyncMode.Disabled)
  ) {
    return Types.SyncStatusStatic.Unknown
  }
  const tlfSyncConfig: Types.TlfSyncConfig = tlf.syncConfig
  // uploading state has higher priority
  if (uploadingPaths.has(path)) {
    return kbfsDaemonStatus.online
      ? Types.SyncStatusStatic.Uploading
      : Types.SyncStatusStatic.AwaitingToUpload
  }
  if (!isPathEnabledForSync(tlfSyncConfig, path)) {
    return Types.SyncStatusStatic.OnlineOnly
  }

  // TODO: what about 'sync-error'?

  // We don't have an upload state, and sync is enabled for this path.
  switch (pathItem.prefetchStatus.state) {
    case Types.PrefetchState.NotStarted:
      return Types.SyncStatusStatic.AwaitingToSync
    case Types.PrefetchState.Complete:
      return Types.SyncStatusStatic.Synced
    case Types.PrefetchState.InProgress:
      if (!kbfsDaemonStatus.online) {
        return Types.SyncStatusStatic.AwaitingToSync
      }
      const inProgress: Types.PrefetchInProgress = pathItem.prefetchStatus
      if (inProgress.bytesTotal === 0) {
        return Types.SyncStatusStatic.AwaitingToSync
      }
      return inProgress.bytesFetched / inProgress.bytesTotal
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(pathItem.prefetchStatus)
      return Types.SyncStatusStatic.Unknown
  }
}

export const makeActionsForDestinationPickerOpen = (
  index: number,
  path: Types.Path,
  routePath?: I.List<string> | null
): Array<TypedActions> => [
  FsGen.createSetDestinationPickerParentPath({
    index,
    path,
  }),
  RouteTreeGen.createNavigateAppend({
    path: [{props: {index}, selected: 'destinationPicker'}],
  }),
]

export const fsRootRouteForNav1 = isMobile ? [Tabs.settingsTab, SettingsConstants.fsTab] : [Tabs.fsTab]

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: Types.Path
): TypedActions => RouteTreeGen.createNavigateAppend({path: [{props: {path}, selected: 'fsRoot'}]})

export const putActionIfOnPathForNav1 = (action: TypedActions, routePath?: I.List<string> | null) => action

// TODO(KBFS-4155): implement this
export const isUnmergedView = (path: Types.Path): boolean => false

export const makeActionsForShowSendLinkToChat = (
  path: Types.Path,
  routePath?: I.List<string> | null
): Array<TypedActions> => [
  FsGen.createInitSendLinkToChat({path}),
  putActionIfOnPathForNav1(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {path}, selected: 'sendLinkToChat'}],
    }),
    routePath
  ),
]

export const makeActionsForShowSendAttachmentToChat = (
  path: Types.Path,
  routePath?: I.List<string> | null
): Array<TypedActions> => [
  FsGen.createInitSendAttachmentToChat({path}),
  putActionIfOnPathForNav1(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {path}, selected: 'sendAttachmentToChat'}],
    }),
    routePath
  ),
]

export const getMainBannerType = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  overallSyncStatus: Types.OverallSyncStatus
): Types.MainBannerType =>
  kbfsDaemonStatus.online
    ? overallSyncStatus.diskSpaceStatus === 'error'
      ? Types.MainBannerType.OutOfSpace
      : Types.MainBannerType.None
    : flags.kbfsOfflineMode
    ? Types.MainBannerType.Offline
    : Types.MainBannerType.None

export const isFolder = (path: Types.Path, pathItem: Types.PathItem) =>
  Types.getPathLevel(path) <= 3 || pathItem.type === Types.PathType.Folder

export const humanizeBytes = (n: number, numDecimals: number): string => {
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024

  if (n < kb) {
    return `${n} bytes`
  } else if (n < mb) {
    return `${(n / kb).toFixed(numDecimals)} KB`
  } else if (n < gb) {
    return `${(n / mb).toFixed(numDecimals)} MB`
  }
  return `${(n / gb).toFixed(numDecimals)} GB`
}

export const humanizeBytesOfTotal = (n: number, d: number): string => {
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024

  if (d < kb) {
    return `${n} of ${d} bytes`
  } else if (d < mb) {
    return `${(n / kb).toFixed(2)} of ${(d / kb).toFixed(2)} KB`
  } else if (d < gb) {
    return `${(n / mb).toFixed(2)} of ${(d / mb).toFixed(2)} MB`
  }
  return `${(n / gb).toFixed(2)} of ${(d / gb).toFixed(2)} GB`
}

export const getTlfPath = (path: Types.Path): Types.Path | null => {
  const elems = Types.getPathElements(path)
  return elems.length > 2 ? Types.pathConcat(Types.pathConcat(defaultPath, elems[1]), elems[2]) : null
}

export const hasPublicTag = (path: Types.Path): boolean => {
  const publicPrefix = '/keybase/public/'
  // The slash after public in `publicPrefix` prevents /keybase/public from counting.
  return Types.pathToString(path).startsWith(publicPrefix)
}

export const getPathUserSetting = (
  pathUserSettings: I.Map<Types.Path, Types.PathUserSetting>,
  path: Types.Path
): Types.PathUserSetting =>
  pathUserSettings.get(
    path,
    Types.getPathLevel(path) < 3 ? defaultTlfListPathUserSetting : defaultPathUserSetting
  )

export const showSortSetting = (
  path: Types.Path,
  pathItem: Types.PathItem,
  kbfsDaemonStatus: Types.KbfsDaemonStatus
) =>
  !isMobile &&
  path !== defaultPath &&
  (Types.getPathLevel(path) === 2 || (pathItem.type === Types.PathType.Folder && !!pathItem.children.size)) &&
  !isOfflineUnsynced(kbfsDaemonStatus, pathItem, path)

export const getSoftError = (softErrors: Types.SoftErrors, path: Types.Path): Types.SoftError | null => {
  const pathError = softErrors.pathErrors.get(path)
  if (pathError) {
    return pathError
  }
  if (!softErrors.tlfErrors.size) {
    return null
  }
  const tlfPath = getTlfPath(path)
  return tlfPath ? softErrors.tlfErrors.get(tlfPath) : null
}

export const erroredActionToMessage = (action: FsGen.Actions, error: string): string => {
  // We have FsError.expectedIfOffline now to take care of real offline
  // scenarios, but we still need to keep this timeout check here in case we
  // get a timeout error when we think we think we're online. In this case it's
  // likely bad network condition.
  const errorIsTimeout = error.includes('context deadline exceeded')
  const timeoutExplain = 'An operation took too long to complete. Are you connected to the Internet?'
  const suffix = errorIsTimeout ? ` ${timeoutExplain}` : ''
  switch (action.type) {
    case FsGen.move:
      return 'Failed to move file(s).' + suffix
    case FsGen.copy:
      return 'Failed to copy file(s).' + suffix
    case FsGen.favoritesLoad:
      return 'Failed to load TLF lists.' + suffix
    case FsGen.refreshLocalHTTPServerInfo:
      return 'Failed to get information about internal HTTP server.' + suffix
    case FsGen.loadPathMetadata:
      return `Failed to load file metadata: ${Types.getPathName(action.payload.path)}.` + suffix
    case FsGen.folderListLoad:
      return `Failed to list folder: ${Types.getPathName(action.payload.path)}.` + suffix
    case FsGen.download:
      return `Failed to download: ${Types.getPathName(action.payload.path)}.` + suffix
    case FsGen.shareNative:
      return `Failed to share: ${Types.getPathName(action.payload.path)}.` + suffix
    case FsGen.saveMedia:
      return `Failed to save: ${Types.getPathName(action.payload.path)}.` + suffix
    case FsGen.upload:
      return `Failed to upload: ${Types.getLocalPathName(action.payload.localPath)}.` + suffix
    case FsGen.favoriteIgnore:
      return `Failed to ignore: ${Types.pathToString(action.payload.path)}.` + suffix
    case FsGen.openPathInSystemFileManager:
      return `Failed to open path: ${Types.pathToString(action.payload.path)}.` + suffix
    case FsGen.openLocalPathInSystemFileManager:
      return `Failed to open path: ${action.payload.localPath}.` + suffix
    case FsGen.deleteFile:
      return `Failed to delete file: ${Types.pathToString(action.payload.path)}.` + suffix
    case FsGen.downloadSuccess:
      return (
        `Failed to ${humanizeDownloadIntent(action.payload.intent)}. ` +
        (errorIsTimeout ? timeoutExplain : `Error: ${error}.`)
      )
    case FsGen.pickAndUpload:
      return 'Failed to upload. ' + (errorIsTimeout ? timeoutExplain : `Error: ${error}.`)
    case FsGen.driverEnable:
      return 'Failed to enable driver.'
    default:
      return errorIsTimeout ? timeoutExplain : 'An unexplainable error has occurred.'
  }
}
