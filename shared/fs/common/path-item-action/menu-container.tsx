import * as C from '../../../constants'
import * as Types from '../../../constants/types/fs'
import * as React from 'react'
import * as Constants from '../../../constants/fs'
import * as ChatConstants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'
import Menu from './menu'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'
import * as Util from '../../../util/kbfs'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
  mode: 'row' | 'screen'
}

const needConfirm = (pathItem: Types.PathItem) =>
  pathItem.type === Types.PathType.File && pathItem.size > 50 * 1024 * 1024

const getDownloadingState = memoize(
  (
    downloads: Types.Downloads,
    downloadID: string | undefined,
    pathItemActionMenu: Types.PathItemActionMenu
  ) => {
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

const addCancelIfNeeded = (action: () => void, cancel: (arg0: string) => void, toCancel?: string) =>
  toCancel
    ? () => {
        action()
        cancel(toCancel)
      }
    : action

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps

  const _downloads = C.useFSState(s => s.downloads)
  const cancelDownload = C.useFSState(s => s.dispatch.cancelDownload)

  const _fileContext = C.useFSState(s => s.fileContext.get(path) || Constants.emptyFileContext)
  const _ignoreNeedsToWait = Container.useAnyWaiting([
    Constants.folderListWaitingKey,
    Constants.statWaitingKey,
  ])
  const _pathItem = C.useFSState(s => Constants.getPathItem(s.pathItems, path))
  const _pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const _downloadID = _pathItemActionMenu.downloadID
  const _sfmiEnabled = C.useFSState(s => s.sfmi.driverStatus.type === Types.DriverStatusType.Enabled)
  const _username = C.useCurrentUserState(s => s.username)
  const _view = _pathItemActionMenu.view
  const _cancel = cancelDownload

  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)

  const _confirmSaveMedia = React.useCallback(() => {
    setPathItemActionMenuView(Types.PathItemActionMenuView.ConfirmSaveMedia)
  }, [setPathItemActionMenuView])
  const _confirmSendToOtherApp = React.useCallback(() => {
    setPathItemActionMenuView(Types.PathItemActionMenuView.ConfirmSendToOtherApp)
  }, [setPathItemActionMenuView])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _delete = () => {
    navigateAppend({props: {mode, path}, selected: 'confirmDelete'})
  }
  const favoriteIgnore = C.useFSState(s => s.dispatch.favoriteIgnore)
  const _ignoreTlf = React.useCallback(() => {
    favoriteIgnore(path)
  }, [favoriteIgnore, path])
  const newFolderRow = C.useFSState(s => s.dispatch.newFolderRow)
  const _newFolder = React.useCallback(() => {
    newFolderRow(path)
  }, [newFolderRow, path])
  const previewConversation = ChatConstants.useState(s => s.dispatch.previewConversation)
  const _openChat = () => {
    previewConversation({
      reason: 'files',
      // tlfToParticipantsOrTeamname will route both public and private
      // folders to a private chat, which is exactly what we want.
      ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
    })
  }
  const startRename = C.useFSState(s => s.dispatch.startRename)
  const download = C.useFSState(s => s.dispatch.download)
  const _download = React.useCallback(() => {
    download(path, 'download')
  }, [download, path])
  const _rename = React.useCallback(() => {
    startRename(path)
  }, [startRename, path])
  const _saveMedia = React.useCallback(() => {
    download(path, 'saveMedia')
  }, [download, path])
  const _sendAttachmentToChat = () => {
    path && navigateAppend({props: {sendPaths: [path]}, selected: 'sendToChat'})
  }
  const _sendToOtherApp = React.useCallback(() => {
    download(path, 'share')
  }, [download, path])
  const _share = React.useCallback(() => {
    setPathItemActionMenuView(Types.PathItemActionMenuView.Share)
  }, [setPathItemActionMenuView])
  const openPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )
  const _showInSystemFileManager = React.useCallback(() => {
    openPathInSystemFileManagerDesktop?.(path)
  }, [openPathInSystemFileManagerDesktop, path])

  const getLayout = _view === 'share' ? getShareLayout : getRootLayout
  const layout = getLayout(mode, ownProps.path, _pathItem, _fileContext, _username)
  const c = (action: any) => (isMobile ? addCancelIfNeeded(action, _cancel, _downloadID) : action)

  const getSendToOtherApp = () => {
    const {sharing} = getDownloadingState(_downloads, _downloadID, _pathItemActionMenu)
    if (sharing) {
      return 'in-progress'
    } else {
      return needConfirm(_pathItem) ? c(_confirmSendToOtherApp) : c(_sendToOtherApp)
    }
  }

  const getSaveMedia = () => {
    const {saving} = getDownloadingState(_downloads, _downloadID, _pathItemActionMenu)
    if (saving) {
      return 'in-progress'
    } else {
      return needConfirm(_pathItem) ? c(_confirmSaveMedia) : c(_saveMedia)
    }
  }

  const props = {
    ...ownProps,
    delete: layout.delete ? c(_delete) : undefined,
    download: layout.download ? c(_download) : undefined,
    ignoreTlf: layout.ignoreTlf ? (_ignoreNeedsToWait ? 'disabled' : c(_ignoreTlf)) : undefined,
    me: _username,
    moveOrCopy: undefined,
    newFolder: layout.newFolder ? c(_newFolder) : undefined,
    openChatNonTeam: layout.openChatNonTeam ? c(_openChat) : undefined,
    openChatTeam: layout.openChatTeam ? c(_openChat) : undefined,
    pathItemType: _pathItem.type,
    rename: layout.rename ? c(_rename) : undefined,
    saveMedia: layout.saveMedia ? getSaveMedia() : undefined,
    sendAttachmentToChat: layout.sendAttachmentToChat ? c(_sendAttachmentToChat) : undefined, // TODO
    sendToOtherApp: layout.sendToOtherApp ? getSendToOtherApp() : undefined,
    share: layout.share ? _share : undefined,
    showInSystemFileManager:
      layout.showInSystemFileManager && _sfmiEnabled ? c(_showInSystemFileManager) : undefined,
  }
  return <Menu {...props} />
}
