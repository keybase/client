import * as I from 'immutable'
import * as Types from './types/fs'
import * as RPCTypes from './types/rpc-gen'
import * as ChatConstants from './chat2'
import * as FsGen from '../actions/fs-gen'
import * as EngineGen from '../actions/engine-gen-gen'
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

export const makeNewFolder = I.Record<Types._NewFolder>({
  hint: 'New Folder',
  name: 'New Folder',
  parentPath: Types.stringToPath('/keybase'),
  status: Types.EditStatusType.Editing,
  type: Types.EditType.NewFolder,
})
export const emptyFolder = makeNewFolder()

const makePrefetchNotStarted = I.Record<Types._PrefetchNotStarted>({
  state: Types.PrefetchState.NotStarted,
})
export const prefetchNotStarted: Types.PrefetchNotStarted = makePrefetchNotStarted()

const makePrefetchComplete = I.Record<Types._PrefetchComplete>({
  state: Types.PrefetchState.Complete,
})
export const prefetchComplete: Types.PrefetchComplete = makePrefetchComplete()

export const makePrefetchInProgress = I.Record<Types._PrefetchInProgress>({
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: Types.PrefetchState.InProgress,
})

const pathItemMetadataDefault = {
  lastModifiedTimestamp: 0,
  lastWriter: '',
  name: 'unknown',
  prefetchStatus: prefetchNotStarted,
  size: 0,
  writable: false,
}

export const makeFolder = I.Record<Types._FolderPathItem>({
  ...pathItemMetadataDefault,
  children: I.Set(),
  progress: Types.ProgressType.Pending,
  type: Types.PathType.Folder,
})

export const makeMime = I.Record<Types._Mime>({
  displayPreview: false,
  mimeType: '',
})

export const makeFile = I.Record<Types._FilePathItem>({
  ...pathItemMetadataDefault,
  mimeType: null,
  type: Types.PathType.File,
})

export const makeSymlink = I.Record<Types._SymlinkPathItem>({
  ...pathItemMetadataDefault,
  linkTarget: '',
  type: Types.PathType.Symlink,
})

export const makeUnknownPathItem = I.Record<Types._UnknownPathItem>({
  ...pathItemMetadataDefault,
  type: Types.PathType.Unknown,
})

export const unknownPathItem = makeUnknownPathItem()

const makeTlfSyncEnabled = I.Record<Types._TlfSyncEnabled>({
  mode: Types.TlfSyncMode.Enabled,
})
export const tlfSyncEnabled: Types.TlfSyncEnabled = makeTlfSyncEnabled()

const makeTlfSyncDisabled = I.Record<Types._TlfSyncDisabled>({
  mode: Types.TlfSyncMode.Disabled,
})
export const tlfSyncDisabled: Types.TlfSyncDisabled = makeTlfSyncDisabled()

export const makeTlfSyncPartial = I.Record<Types._TlfSyncPartial>({
  enabledPaths: I.List(),
  mode: Types.TlfSyncMode.Partial,
})

export const makeConflictStateNormalView = I.Record<Types._ConflictStateNormalView>({
  localViewTlfPaths: I.List(),
  resolvingConflict: false,
  stuckInConflict: false,
  type: Types.ConflictStateType.NormalView,
})

export const tlfNormalViewWithNoConflict = makeConflictStateNormalView()

export const makeConflictStateManualResolvingLocalView = I.Record<
  Types._ConflictStateManualResolvingLocalView
>({
  normalViewTlfPath: defaultPath,
  type: Types.ConflictStateType.ManualResolvingLocalView,
})

export const makeTlf = I.Record<Types._Tlf>({
  conflictState: tlfNormalViewWithNoConflict,
  isFavorite: false,
  isIgnored: false,
  isNew: false,
  name: '',
  resetParticipants: I.List(),
  syncConfig: tlfSyncDisabled,
  teamId: '',
  tlfMtime: 0,
  /* See comment in constants/types/fs.js
  needsRekey: false,
  waitingForParticipantUnlock: I.List(),
  youCanUnlock: I.List(),
  */
})

export const makeSyncingFoldersProgress = I.Record<Types._SyncingFoldersProgress>({
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  start: 0,
})

export const makeOverallSyncStatus = I.Record<Types._OverallSyncStatus>({
  diskSpaceStatus: Types.DiskSpaceStatus.Ok,
  showingBanner: false,
  syncingFoldersProgress: makeSyncingFoldersProgress(),
})

export const makePathUserSetting = I.Record<Types._PathUserSetting>({
  sort: Types.SortSetting.NameAsc,
})

export const defaultPathUserSetting = makePathUserSetting({
  sort: Types.SortSetting.NameAsc,
})

export const defaultTlfListPathUserSetting = makePathUserSetting({
  sort: Types.SortSetting.TimeAsc,
})

export const makeDownloadMeta = I.Record<Types._DownloadMeta>({
  entryType: Types.PathType.Unknown,
  intent: Types.DownloadIntent.None,
  localPath: '',
  opID: null,
  path: Types.stringToPath(''),
})

export const makeDownloadState = I.Record<Types._DownloadState>({
  canceled: false,
  completePortion: 0,
  endEstimate: undefined,
  error: undefined,
  isDone: false,
  startedAt: 0,
})

export const makeDownload = I.Record<Types._Download>({
  meta: makeDownloadMeta(),
  state: makeDownloadState(),
})

export const makeLocalHTTPServer = I.Record<Types._LocalHTTPServer>({
  address: '',
  token: '',
})

export const makeUploads = I.Record<Types._Uploads>({
  endEstimate: undefined,
  errors: I.Map(),

  syncingPaths: I.Set(),
  totalSyncingBytes: 0,
  writingToJournal: I.Set(),
})

export const makeTlfs = I.Record<Types._Tlfs>({
  loaded: false,
  private: I.Map(),
  public: I.Map(),
  team: I.Map(),
})

const placeholderAction = FsGen.createPlaceholderAction()

const _makeError = I.Record<Types._FsError>({
  errorMessage: 'unknown error',
  erroredAction: placeholderAction,
  retriableAction: undefined,
  time: 0,
})

type _MakeErrorArgs = {
  time?: number
  error: any
  erroredAction: FsGen.Actions | EngineGen.Actions
  retriableAction?: FsGen.Actions | EngineGen.Actions
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

export const makeMoveOrCopySource = I.Record<Types._MoveOrCopySource>({
  path: Types.stringToPath(''),
  type: Types.DestinationPickerSource.MoveOrCopy,
})

export const makeIncomingShareSource = I.Record<Types._IncomingShareSource>({
  localPath: Types.stringToLocalPath(''),
  type: Types.DestinationPickerSource.IncomingShare,
})

export const makeNoSource = I.Record<Types._NoSource>({
  type: Types.DestinationPickerSource.None,
})

export const makeDestinationPicker = I.Record<Types._DestinationPicker>({
  destinationParentPath: I.List(),
  source: makeNoSource(),
})

export const makeSendAttachmentToChat = I.Record<Types._SendAttachmentToChat>({
  convID: ChatConstants.noConversationIDKey,
  filter: '',
  path: Types.stringToPath('/keybase'),
  state: Types.SendAttachmentToChatState.None,
  title: '',
})

export const makeSendLinkToChat = I.Record<Types._SendLinkToChat>({
  channels: I.Map(),
  convID: ChatConstants.noConversationIDKey,
  path: Types.stringToPath('/keybase'),
  state: Types.SendLinkToChatState.None,
})

export const makePathItemActionMenu = I.Record<Types._PathItemActionMenu>({
  downloadKey: null,
  previousView: Types.PathItemActionMenuView.Root,
  view: Types.PathItemActionMenuView.Root,
})

export const makeDriverStatusUnknown = I.Record<Types._DriverStatusUnknown>({
  type: Types.DriverStatusType.Unknown,
})

export const makeDriverStatusEnabled = I.Record<Types._DriverStatusEnabled>({
  dokanOutdated: false,
  dokanUninstallExecPath: null,
  isDisabling: false,
  isNew: false,
  type: Types.DriverStatusType.Enabled,
})

export const makeDriverStatusDisabled = I.Record<Types._DriverStatusDisabled>({
  isDismissed: false,
  isEnabling: false,
  kextPermissionError: false,
  type: Types.DriverStatusType.Disabled,
})

export const defaultDriverStatus = isLinux ? makeDriverStatusEnabled() : makeDriverStatusUnknown()

export const makeSystemFileManagerIntegration = I.Record<Types._SystemFileManagerIntegration>({
  driverStatus: defaultDriverStatus,
  showingBanner: false,
})

export const makeKbfsDaemonStatus = I.Record<Types._KbfsDaemonStatus>({
  onlineStatus: Types.KbfsDaemonOnlineStatus.Unknown,
  rpcStatus: Types.KbfsDaemonRpcStatus.Unknown,
})

export const makeSoftErrors = I.Record<Types._SoftErrors>({
  pathErrors: I.Map(),
  tlfErrors: I.Map(),
})

export const makeSettings = I.Record<Types._Settings>({
  isLoading: false,
  spaceAvailableNotificationThreshold: 0,
})

export const makeState = I.Record<Types._State>({
  destinationPicker: makeDestinationPicker(),
  downloads: I.Map(),
  edits: I.Map(),
  errors: I.Map(),
  folderViewFilter: '',
  kbfsDaemonStatus: makeKbfsDaemonStatus(),
  lastPublicBannerClosedTlf: '',
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
})

// RPC expects a string that's interpreted as [16]byte on Go side.
export const makeUUID = () => uuidv1({}, Buffer.alloc(16), 0).toString()

export const pathToRPCPath = (path: Types.Path): RPCTypes.Path => ({
  PathType: RPCTypes.PathType.kbfs,
  kbfs: {
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
    path: Types.pathToString(path).substring('/keybase'.length) || '/',
  },
})

export const pathTypeToTextType = (type: Types.PathType) =>
  type === Types.PathType.Folder ? 'BodySemibold' : 'Body'

export const splitTlfIntoUsernames = (tlf: string): Array<string> =>
  tlf
    .split(' ')[0]
    .replace(/#/g, ',')
    .split(',')

export const getUsernamesFromPath = (path: Types.Path): Array<string> => {
  const elems = Types.getPathElements(path)
  return elems.length < 3 ? [] : splitTlfIntoUsernames(elems[2])
}

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

export const makeTlfUpdate = I.Record<Types._TlfUpdate>({
  history: I.List(),
  path: Types.stringToPath(''),
  serverTime: 0,
  writer: '',
})

export const makeTlfEdit = I.Record<Types._TlfEdit>({
  editType: Types.FileEditType.Unknown,
  filename: '',
  serverTime: 0,
})

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
  let updates: Array<Types.TlfUpdate> = []
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
    if (mimeType.startsWith('audio/')) {
      return Types.FileViewType.Audio
    }
    if (mimeType.startsWith('video/')) {
      return Types.FileViewType.Video
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
    case Types.TlfType.Team: {
      const tlfType: Types.TlfType = visibility
      return {tlfList: getTlfListFromType(tlfs, tlfType), tlfType}
    }
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
  daemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline &&
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
  Types.pathToString(path).replace(/(\\)|( )/g, (_, p1, p2) => `\\${p1 || p2}`)
export const unescapePath = (escaped: string): Types.Path =>
  Types.stringToPath(escaped.replace(/\\(\\)|\\( )/g, (_, p1, p2) => p1 || p2)) // turns "\\" into "\", and "\ " into " "

const makeParsedPathRoot = I.Record<Types._ParsedPathRoot>({kind: Types.PathKind.Root})
export const parsedPathRoot: Types.ParsedPathRoot = makeParsedPathRoot()

const makeParsedPathTlfList = I.Record<Types._ParsedPathTlfList>({
  kind: Types.PathKind.TlfList,
  tlfType: Types.TlfType.Private,
})
export const parsedPathPrivateList: Types.ParsedPathTlfList = makeParsedPathTlfList()
export const parsedPathPublicList: Types.ParsedPathTlfList = makeParsedPathTlfList({
  tlfType: Types.TlfType.Public,
})
export const parsedPathTeamList: Types.ParsedPathTlfList = makeParsedPathTlfList({
  tlfType: Types.TlfType.Team,
})

const makeParsedPathGroupTlf = I.Record<Types._ParsedPathGroupTlf>({
  kind: Types.PathKind.GroupTlf,
  readers: null,
  tlfName: '',
  tlfType: Types.TlfType.Private,
  writers: I.List(),
})

const makeParsedPathTeamTlf = I.Record<Types._ParsedPathTeamTlf>({
  kind: Types.PathKind.TeamTlf,
  team: '',
  tlfName: '',
  tlfType: Types.TlfType.Team,
})

const makeParsedPathInGroupTlf = I.Record<Types._ParsedPathInGroupTlf>({
  kind: Types.PathKind.InGroupTlf,
  readers: null,
  rest: I.List(),
  tlfName: '',
  tlfType: Types.TlfType.Private,
  writers: I.List(),
})

const makeParsedPathInTeamTlf = I.Record<Types._ParsedPathInTeamTlf>({
  kind: Types.PathKind.InTeamTlf,
  rest: I.List(),
  team: '',
  tlfName: '',
  tlfType: Types.TlfType.Team,
})

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

export const rebasePathToDifferentTlf = (path: Types.Path, newTlfPath: Types.Path) =>
  Types.pathConcat(
    newTlfPath,
    Types.getPathElements(path)
      .slice(3)
      .join('/')
  )

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
    return kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline
      ? Types.SyncStatusStatic.AwaitingToUpload
      : Types.SyncStatusStatic.Uploading
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
    case Types.PrefetchState.InProgress: {
      if (kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline) {
        return Types.SyncStatusStatic.AwaitingToSync
      }
      const inProgress: Types.PrefetchInProgress = pathItem.prefetchStatus
      if (inProgress.bytesTotal === 0) {
        return Types.SyncStatusStatic.AwaitingToSync
      }
      return inProgress.bytesFetched / inProgress.bytesTotal
    }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(pathItem.prefetchStatus)
      return Types.SyncStatusStatic.Unknown
  }
}

export const makeActionsForDestinationPickerOpen = (
  index: number,
  path: Types.Path,
  navigateAppend: typeof RouteTreeGen.createNavigateAppend
): Array<TypedActions> => [
  FsGen.createSetDestinationPickerParentPath({
    index,
    path,
  }),
  navigateAppend({
    path: [{props: {index}, selected: 'destinationPicker'}],
  }),
]

export const fsRootRouteForNav1 = isMobile ? [Tabs.settingsTab, SettingsConstants.fsTab] : [Tabs.fsTab]

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: Types.Path
): TypedActions => RouteTreeGen.createNavigateAppend({path: [{props: {path}, selected: 'fsRoot'}]})

export const putActionIfOnPathForNav1 = (action: TypedActions) => action

export const makeActionsForShowSendLinkToChat = (path: Types.Path): Array<TypedActions> => [
  FsGen.createInitSendLinkToChat({path}),
  putActionIfOnPathForNav1(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {path}, selected: 'sendLinkToChat'}],
    })
  ),
]

export const makeActionsForShowSendAttachmentToChat = (path: Types.Path): Array<TypedActions> => [
  FsGen.createInitSendAttachmentToChat({path}),
  putActionIfOnPathForNav1(
    RouteTreeGen.createNavigateAppend({
      path: [{props: {path}, selected: 'sendAttachmentToChat'}],
    })
  ),
]

export const getMainBannerType = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  overallSyncStatus: Types.OverallSyncStatus
): Types.MainBannerType =>
  kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline
    ? flags.kbfsOfflineMode
      ? Types.MainBannerType.Offline
      : Types.MainBannerType.None
    : overallSyncStatus.diskSpaceStatus === 'error'
    ? Types.MainBannerType.OutOfSpace
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
  return (tlfPath && softErrors.tlfErrors.get(tlfPath)) || null
}

export const hasSpecialFileElement = (path: Types.Path): boolean =>
  Types.getPathElements(path).some(elem => elem.startsWith('.kbfs'))

export const erroredActionToMessage = (action: FsGen.Actions | EngineGen.Actions, error: string): string => {
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
