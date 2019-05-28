// @flow
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as ConfigGen from '../../../actions/config-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'
import flags from '../../../util/feature-flags'
import Menu from './menu'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {fsTab} from '../../../constants/tabs'
import * as Util from '../../../util/kbfs'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  mode: 'row' | 'screen',
  routePath: I.List<string>,
  // 'row' means this is an itme on a row where there are more than one
  // PathItem on the screen and this is just one of them. 'screen' means this
  // is for the PathItem that this screen is associated with, e.g., in header.
|}

const mapStateToProps = (state, {path}) => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _sfmiEnabled: state.fs.sfmi.driverStatus === 'enabled',
  _username: state.config.username,
  _view: state.fs.pathItemActionMenu.view,
})

const mapDispatchToProps = (dispatch, {mode, path, routePath}: OwnProps) => ({
  _cancel: (key: string) => dispatch(FsGen.createCancelDownload({key})),
  _confirmSaveMedia: (toCancel: ?string) =>
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'confirm-save-media'})),
  _confirmSendToOtherApp: () =>
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'confirm-send-to-other-app'})),
  _copyPath: () => dispatch(ConfigGen.createCopyToClipboard({text: Constants.escapePath(path)})),
  _delete: () => {
    dispatch(
      RouteTreeGen.createNavigateTo({
        parentPath: [fsTab],
        path: [{props: {mode, path}, selected: 'confirmDelete'}],
      })
    )
  },
  _download: () => dispatch(FsGen.createDownload({key: Constants.makeDownloadKey(path), path})),
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
  _saveMedia: () => {
    const key = Constants.makeDownloadKey(path)
    dispatch(FsGen.createSaveMedia({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
  },
  _sendAttachmentToChat: () =>
    Constants.makeActionsForShowSendAttachmentToChat(path, routePath).forEach(action => dispatch(action)),
  _sendLinkToChat: () =>
    Constants.makeActionsForShowSendLinkToChat(path, routePath).forEach(action => dispatch(action)),
  _sendToOtherApp: () => {
    const key = Constants.makeDownloadKey(path)
    dispatch(FsGen.createShareNative({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
  },
  _share: () => dispatch(FsGen.createSetPathItemActionMenuView({view: 'share'})),
  _showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const needConfirm = (pathItem: Types.PathItem) => pathItem.type === 'file' && pathItem.size > 50 * 1024 * 1024

const getDownloadingState = memoize<
  Types.Downloads,
  ?string,
  void,
  void,
  {|
    done: boolean,
    saving: boolean,
    sharing: boolean,
  |}
>((downloads: Types.Downloads, downloadKey: ?string) => {
  if (!downloadKey) {
    return {done: true, saving: false, sharing: false}
  }
  const download = downloads.get(downloadKey)
  const intent = download && download.meta.intent
  const done = !download || download.state.isDone || !!download.state.error || download.state.canceled
  if (!intent) {
    return {done, saving: false, sharing: false}
  }
  return {done, saving: intent === 'camera-roll', sharing: intent === 'share'}
})

const addCancelIfNeeded = (action: () => void, cancel: string => void, toCancel: ?string) =>
  toCancel
    ? () => {
        action()
        cancel(toCancel)
      }
    : action

const shouldHideMenu = stateProps => {
  const {saving, sharing, done} = getDownloadingState(stateProps._downloads, stateProps._downloadKey)
  return (saving || sharing) && done
}

const getSendToOtherApp = (stateProps, dispatchProps, c) => {
  const {sharing} = getDownloadingState(stateProps._downloads, stateProps._downloadKey)
  if (sharing) {
    return 'in-progress'
  } else {
    return needConfirm(stateProps._pathItem)
      ? c(dispatchProps._confirmSendToOtherApp)
      : c(dispatchProps._sendToOtherApp)
  }
}

const getSaveMedia = (stateProps, dispatchProps, c) => {
  const {saving} = getDownloadingState(stateProps._downloads, stateProps._downloadKey)
  if (saving) {
    return 'in-progress'
  } else {
    return needConfirm(stateProps._pathItem)
      ? c(dispatchProps._confirmSaveMedia)
      : c(dispatchProps._saveMedia)
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const getLayout = stateProps._view === 'share' ? getShareLayout : getRootLayout
  const {mode, ...rest} = ownProps
  const layout = getLayout(mode, ownProps.path, stateProps._pathItem, stateProps._username)
  const c = action =>
    isMobile ? addCancelIfNeeded(action, dispatchProps._cancel, stateProps._downloadKey) : action
  return {
    ...rest,
    shouldHideMenu: shouldHideMenu(stateProps),
    // menu items
    // eslint-disable-next-line sort-keys
    copyPath: layout.copyPath ? c(dispatchProps._copyPath) : null,
    delete: layout.delete ? c(dispatchProps._delete) : null,
    download: layout.download ? c(dispatchProps._download) : null,
    ignoreTlf: layout.ignoreTlf ? c(dispatchProps._ignoreTlf) : null,
    me: stateProps._username,
    moveOrCopy: flags.moveOrCopy && layout.moveOrCopy ? c(dispatchProps._moveOrCopy) : null,
    newFolder: layout.newFolder ? c(dispatchProps._newFolder) : null,
    openChatNonTeam: layout.openChatNonTeam ? c(dispatchProps._openChat) : null,
    openChatTeam: layout.openChatTeam ? c(dispatchProps._openChat) : null,
    pathItemType: stateProps._pathItem.type,
    saveMedia: layout.saveMedia ? getSaveMedia(stateProps, dispatchProps, c) : null,
    showInSystemFileManager:
      layout.showInSystemFileManager && stateProps._sfmiEnabled
        ? c(dispatchProps._showInSystemFileManager)
        : null,
    // share items
    // eslint-disable-next-line sort-keys
    sendAttachmentToChat: layout.sendAttachmentToChat ? c(dispatchProps._sendAttachmentToChat) : null, // TODO
    sendLinkToChat: layout.sendLinkToChat ? c(dispatchProps._sendLinkToChat) : null,
    sendToOtherApp: layout.sendToOtherApp ? getSendToOtherApp(stateProps, dispatchProps, c) : null,
    share: layout.share ? dispatchProps._share : null,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionMenu'
)(Menu)
