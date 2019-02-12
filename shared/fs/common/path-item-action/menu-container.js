// @flow
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as ConfigGen from '../../../actions/config-gen'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'
import flags from '../../../util/feature-flags'
import Menu from './menu'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapStateToProps = (state, {path}) => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
  _downloads: state.fs.downloads,
  _fileUIEnabled: Constants.kbfsEnabled(state),
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _username: state.config.username,
  _view: state.fs.pathItemActionMenu.view,
})

const mapDispatchToProps = (dispatch, {path, routePath}: OwnProps) => ({
  _cancel: (key: string) => dispatch(FsGen.createCancelDownload({key})),
  _confirmSaveMedia: (toCancel: ?string) =>
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'confirm-save-media'})),
  _confirmSendToOtherApp: () =>
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'confirm-send-to-other-app'})),
  _copyPath: () => dispatch(ConfigGen.createCopyToClipboard({text: Constants.escapePath(path)})),
  _delete: () => {
    dispatch(FsGen.createDeleteFile({path}))
    dispatch(FsGen.createOpenPathInFilesTab({path: Types.getPathParent(path), routePath}))
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
  _saveMedia: () => {
    const key = Constants.makeDownloadKey(path)
    dispatch(FsGen.createSaveMedia({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
  },
  _sendLinkToChat: () => dispatch(FsGen.createShowSendLinkToChat({path, routePath})),
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
  const layout = getLayout(ownProps.path, stateProps._pathItem)
  const c = action =>
    isMobile ? addCancelIfNeeded(action, dispatchProps._cancel, stateProps._downloadKey) : action
  return {
    ...ownProps,
    shouldHideMenu: shouldHideMenu(stateProps),
    // menu items
    // eslint-disable-next-line sort-keys
    copyPath: layout.copyPath ? c(dispatchProps._copyPath) : null,
    delete: layout.delete ? c(dispatchProps._delete) : null,
    download: layout.download ? c(dispatchProps._download) : null,
    ignoreTlf: layout.ignoreTlf ? c(dispatchProps._ignoreTlf) : null,
    moveOrCopy: flags.moveOrCopy && layout.moveOrCopy ? c(dispatchProps._moveOrCopy) : null,
    saveMedia: layout.saveMedia ? getSaveMedia(stateProps, dispatchProps, c) : null,
    showInSystemFileManager: layout.showInSystemFileManager
      ? c(dispatchProps._showInSystemFileManager)
      : null,
    // share items
    // eslint-disable-next-line sort-keys
    sendAttachmentToChat: null, // TODO
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
