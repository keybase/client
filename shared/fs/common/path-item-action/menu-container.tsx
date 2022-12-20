import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'
import Menu from './menu'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Util from '../../../util/kbfs'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
  mode: 'row' | 'screen'
}

const mapStateToProps = (state: Container.TypedState, {path}: OwnProps) => ({
  _downloadID: state.fs.pathItemActionMenu.downloadID,
  _downloads: state.fs.downloads,
  _fileContext: state.fs.fileContext.get(path) || Constants.emptyFileContext,
  _ignoreNeedsToWait: anyWaiting(state, Constants.folderListWaitingKey, Constants.statWaitingKey),
  _pathItem: Constants.getPathItem(state.fs.pathItems, path),
  _pathItemActionMenu: state.fs.pathItemActionMenu,
  _sfmiEnabled: state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled,
  _username: state.config.username,
  _view: state.fs.pathItemActionMenu.view,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {mode, path}: OwnProps) => ({
  _cancel: (downloadID: string) => dispatch(FsGen.createCancelDownload({downloadID})),
  _confirmSaveMedia: () =>
    dispatch(FsGen.createSetPathItemActionMenuView({view: Types.PathItemActionMenuView.ConfirmSaveMedia})),
  _confirmSendToOtherApp: () =>
    dispatch(
      FsGen.createSetPathItemActionMenuView({view: Types.PathItemActionMenuView.ConfirmSendToOtherApp})
    ),
  _delete: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {mode, path}, selected: 'confirmDelete'}],
      })
    )
  },
  _download: () => dispatch(FsGen.createDownload({path})),
  _ignoreTlf: () => dispatch(FsGen.createFavoriteIgnore({path})),
  _moveOrCopy: () => {
    dispatch(FsGen.createSetMoveOrCopySource({path}))
    dispatch(
      FsGen.createShowMoveOrCopy({
        initialDestinationParentPath: Types.getPathParent(path),
      })
    )
  },
  _newFolder: () =>
    dispatch(
      FsGen.createNewFolderRow({
        parentPath: path,
      })
    ),
  _openChat: () =>
    dispatch(
      Chat2Gen.createPreviewConversation({
        reason: 'files',
        // tlfToParticipantsOrTeamname will route both public and private
        // folders to a private chat, which is exactly what we want.
        ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
      })
    ),
  _rename: () => dispatch(FsGen.createStartRename({path})),
  _saveMedia: () => {
    dispatch(FsGen.createSaveMedia({path}))
  },
  _sendAttachmentToChat: () => {
    path &&
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {sendPaths: [path]}, selected: 'sendToChat'}],
        })
      )
  },
  _sendToOtherApp: () => {
    dispatch(FsGen.createShareNative({path}))
  },
  _share: () => dispatch(FsGen.createSetPathItemActionMenuView({view: Types.PathItemActionMenuView.Share})),
  _showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const needConfirm = (pathItem: Types.PathItem) =>
  pathItem.type === Types.PathType.File && pathItem.size > 50 * 1024 * 1024

const getDownloadingState = memoize(
  (downloads: Types.Downloads, downloadID: string | null, pathItemActionMenu: Types.PathItemActionMenu) => {
    if (!downloadID) {
      return {done: true, saving: false, sharing: false}
    }
    const downloadState = downloads.state.get(downloadID) || Constants.emptyDownloadState
    const intent = pathItemActionMenu.downloadIntent
    const done = downloadState !== Constants.emptyDownloadState && !Constants.downloadIsOngoing(downloadState)
    if (!intent) {
      return {done, saving: false, sharing: false}
    }
    return {
      done,
      saving: intent === Types.DownloadIntent.CameraRoll,
      sharing: intent === Types.DownloadIntent.Share,
    }
  }
)

const addCancelIfNeeded = (action: () => void, cancel: (arg0: string) => void, toCancel: string | null) =>
  toCancel
    ? () => {
        action()
        cancel(toCancel)
      }
    : action

const getSendToOtherApp = (stateProps, dispatchProps, c) => {
  const {sharing} = getDownloadingState(
    stateProps._downloads,
    stateProps._downloadID,
    stateProps._pathItemActionMenu
  )
  if (sharing) {
    return 'in-progress'
  } else {
    return needConfirm(stateProps._pathItem)
      ? c(dispatchProps._confirmSendToOtherApp)
      : c(dispatchProps._sendToOtherApp)
  }
}

const getSaveMedia = (stateProps, dispatchProps, c) => {
  const {saving} = getDownloadingState(
    stateProps._downloads,
    stateProps._downloadID,
    stateProps._pathItemActionMenu
  )
  if (saving) {
    return 'in-progress'
  } else {
    return needConfirm(stateProps._pathItem)
      ? c(dispatchProps._confirmSaveMedia)
      : c(dispatchProps._saveMedia)
  }
}

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  const getLayout = stateProps._view === 'share' ? getShareLayout : getRootLayout
  const {mode, ...rest} = ownProps
  const layout = getLayout(
    mode,
    ownProps.path,
    stateProps._pathItem,
    stateProps._fileContext,
    stateProps._username
  )
  const c = action =>
    isMobile ? addCancelIfNeeded(action, dispatchProps._cancel, stateProps._downloadID) : action
  return {
    ...rest,
    // menu items

    delete: layout.delete ? c(dispatchProps._delete) : null,
    download: layout.download ? c(dispatchProps._download) : null,
    ignoreTlf: layout.ignoreTlf
      ? stateProps._ignoreNeedsToWait
        ? 'disabled'
        : c(dispatchProps._ignoreTlf)
      : null,
    me: stateProps._username,
    moveOrCopy: null,
    newFolder: layout.newFolder ? c(dispatchProps._newFolder) : null,
    openChatNonTeam: layout.openChatNonTeam ? c(dispatchProps._openChat) : null,
    openChatTeam: layout.openChatTeam ? c(dispatchProps._openChat) : null,
    pathItemType: stateProps._pathItem.type,
    rename: layout.rename ? c(dispatchProps._rename) : null,
    saveMedia: layout.saveMedia ? getSaveMedia(stateProps, dispatchProps, c) : null,
    showInSystemFileManager:
      layout.showInSystemFileManager && stateProps._sfmiEnabled
        ? c(dispatchProps._showInSystemFileManager)
        : null,
    // share items
    // eslint-disable-next-line sort-keys
    sendAttachmentToChat: layout.sendAttachmentToChat ? c(dispatchProps._sendAttachmentToChat) : null, // TODO
    sendToOtherApp: layout.sendToOtherApp ? getSendToOtherApp(stateProps, dispatchProps, c) : null,
    share: layout.share ? dispatchProps._share : null,
  }
}

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(Menu)
