// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as ConfigGen from '../../../actions/config-gen'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile, isAndroid} from '../../../constants/platform'
import flags from '../../../util/feature-flags'
import PathItemAction from '.'

type OwnProps = {|
  path: Types.Path,
  actionIconClassName?: string,
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
|}

const mapStateToProps = state => ({
  _downloads: state.fs.downloads,
  _fileUIEnabled: Constants.kbfsEnabled(state),
  _pathItems: state.fs.pathItems,
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _download: () => dispatch(FsGen.createDownload(Constants.makeDownloadPayload(path))),
  _saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
  _shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
  _showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
  copyPath: () => dispatch(ConfigGen.createCopyToClipboard({text: Constants.escapePath(path)})),
  deleteFileOrFolder: () => dispatch(FsGen.createDeleteFile({path})),
  ignoreFolder: () => dispatch(FsGen.createFavoriteIgnore({path})),
  moveOrCopy: () => {
    dispatch(FsGen.createSetMoveOrCopySource({path}))
    dispatch(
      FsGen.createShowMoveOrCopy({
        initialDestinationParentPath: Types.getPathParent(path),
      })
    )
  },
  onHidden: () => dispatch(FsGen.createClearRefreshTag({refreshTag: 'path-item-action-popup'})),
})

type actions = {
  showInSystemFileManager?: () => void,
  ignoreFolder?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
  download?: () => void,
  copyPath?: () => void,
  deleteFileOrFolder?: () => void,
  moveOrCopy?: () => void,
}

const aShowIn = (menuActions, stateProps, dispatchProps, path) => {
  if (!isMobile && stateProps._fileUIEnabled) {
    menuActions.showInSystemFileManager = dispatchProps._showInSystemFileManager
  }
}

const aCopyPath = (menuActions, stateProps, dispatchProps, path) => {
  menuActions.copyPath = dispatchProps.copyPath
}

const aIgnore = (menuActions, stateProps, dispatchProps, path) => {
  if (Constants.showIgnoreFolder(path, stateProps._username || '')) {
    menuActions.ignoreFolder = dispatchProps.ignoreFolder
  }
}

const aSave = (menuActions, stateProps, dispatchProps, path) => {
  const pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  if (isMobile && pathItem.type !== 'folder' && Constants.isMedia(pathItem)) {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'camera-roll'))) {
      menuActions.saveMedia = 'disabled'
    } else {
      menuActions.saveMedia = dispatchProps._saveMedia
    }
  }
}

const aShareNative = (menuActions, stateProps, dispatchProps, path) => {
  if (isMobile && stateProps._pathItems.get(path, Constants.unknownPathItem).type === 'file') {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'share'))) {
      menuActions.shareNative = 'disabled'
    } else {
      menuActions.shareNative = dispatchProps._shareNative
    }
  }
}

const aDownload = (menuActions, stateProps, dispatchProps, path) => {
  if (
    !isMobile ||
    (isAndroid && stateProps._pathItems.get(path, Constants.unknownPathItem).type !== 'folder')
  ) {
    menuActions.download = dispatchProps._download
  }
}

const aDelete = (menuActions, stateProps, dispatchProps, path) => {
  menuActions.deleteFileOrFolder = dispatchProps.deleteFileOrFolder
}

const aMoveOrCopy = (menuActions, stateProps, dispatchProps, path) => {
  menuActions.moveOrCopy = dispatchProps.moveOrCopy
}

const tlfListAppenders = [aShowIn, aCopyPath]
const tlfAppenders = [aShowIn, aIgnore, aCopyPath]
const inTlfAppenders = [
  aShowIn,
  aSave,
  aShareNative,
  aDownload,
  aCopyPath,
  ...(flags.moveOrCopy ? [aMoveOrCopy] : []),
  aDelete,
]

const getRootMenuActionsByAppenders = (appenders, stateProps, dispatchProps, path: Types.Path) => {
  const menuActions: actions = {}
  appenders.forEach(appender => appender(menuActions, stateProps, dispatchProps, path), ({}: actions))
  return menuActions
}

const getRootMenuActionsByPathLevel = (pathLevel: number, stateProps, dispatchProps, path: Types.Path) => {
  switch (pathLevel) {
    case 0:
      // The action is for `/`. This shouldn't be possible.
      return {}
    case 1:
      // The action is for `/keybase`. This shouldn't be possible as we never
      // have a /keybase row, and we don't show ... menu for root view.
      return {}
    case 2:
      // The action is for a tlf list, i.e. /keybase/private, /keybase/public,
      // or /keybase/team.
      return getRootMenuActionsByAppenders(tlfListAppenders, stateProps, dispatchProps, path)
    case 3:
      // The action is for a tlf.
      return getRootMenuActionsByAppenders(tlfAppenders, stateProps, dispatchProps, path)
    default:
      // The action is for something inside a tlf
      return getRootMenuActionsByAppenders(inTlfAppenders, stateProps, dispatchProps, path)
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_pathItems} = stateProps
  const {path, actionIconClassName, actionIconFontSize, actionIconWhite} = ownProps
  const pathElements = Types.getPathElements(path)
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  const type = pathElements.length <= 3 ? 'folder' : pathItem.type
  const {
    showInSystemFileManager,
    ignoreFolder,
    saveMedia,
    shareNative,
    download,
    copyPath,
    deleteFileOrFolder,
    moveOrCopy,
  } = getRootMenuActionsByPathLevel(pathElements.length, stateProps, dispatchProps, path)
  return {
    actionIconClassName,
    actionIconFontSize,
    actionIconWhite,
    copyPath,
    deleteFileOrFolder,
    download,
    ignoreFolder,
    moveOrCopy,
    onHidden: dispatchProps.onHidden,
    path,
    saveMedia,
    shareNative,
    showInSystemFileManager,
    type,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemAction'
)(PathItemAction)
