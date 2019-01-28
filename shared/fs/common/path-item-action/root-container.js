// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as ConfigGen from '../../../actions/config-gen'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile, isAndroid} from '../../../constants/platform'
import flags from '../../../util/feature-flags'
import Root from './root'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  path: Types.Path,
  floatingMenuProps: FloatingMenuProps,
|}

const mapStateToProps = (state, {path}) => ({
  _downloads: state.fs.downloads,
  _fileUIEnabled: Constants.kbfsEnabled(state),
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
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

type Actions = {|
  copyPath?: () => void,
  deleteFileOrFolder?: () => void,
  download?: () => void,
  ignoreFolder?: () => void,
  moveOrCopy?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
  showInSystemFileManager?: () => void,
|}

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
  if (isMobile && stateProps._pathItem.type !== 'folder' && Constants.isMedia(stateProps._pathItem)) {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'camera-roll'))) {
      menuActions.saveMedia = 'disabled'
    } else {
      menuActions.saveMedia = dispatchProps._saveMedia
    }
  }
}

const aShareNative = (menuActions, stateProps, dispatchProps, path) => {
  if (isMobile && stateProps._pathItem.type === 'file') {
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'share'))) {
      menuActions.shareNative = 'disabled'
    } else {
      menuActions.shareNative = dispatchProps._shareNative
    }
  }
}

const aDownload = (menuActions, stateProps, dispatchProps, path) => {
  if (!isMobile || (isAndroid && stateProps._pathItem.type !== 'folder')) {
    menuActions.download = dispatchProps._download
  }
}

const aDelete = (menuActions, stateProps, dispatchProps, path) => {
  if (Types.getPathLevel(path) <= 3 || stateProps._pathItem.type === 'file') {
    menuActions.deleteFileOrFolder = dispatchProps.deleteFileOrFolder
  }
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

const makeMenuActions = (): Actions => ({
  copyPath: undefined,
  deleteFileOrFolder: undefined,
  download: undefined,
  ignoreFolder: undefined,
  moveOrCopy: undefined,
  saveMedia: undefined,
  shareNative: undefined,
  showInSystemFileManager: undefined,
})

const getRootMenuActionsByAppenders = (appenders, stateProps, dispatchProps, path: Types.Path): Actions => {
  const menuActions = makeMenuActions()
  appenders.forEach(appender => appender(menuActions, stateProps, dispatchProps, path))
  return menuActions
}

const getRootMenuActionsByPathLevel = (
  pathLevel: number,
  stateProps,
  dispatchProps,
  path: Types.Path
): Actions => {
  switch (pathLevel) {
    case 0:
      // The action is for `/`. This shouldn't be possible.
      return makeMenuActions()
    case 1:
      // The action is for `/keybase`. This shouldn't be possible as we never
      // have a /keybase row, and we don't show ... menu for root view.
      return makeMenuActions()
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...getRootMenuActionsByPathLevel(
    Types.getPathLevel(ownProps.path),
    stateProps,
    dispatchProps,
    ownProps.path
  ),
  onHidden: dispatchProps.onHidden,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionRoot'
)(Root)
