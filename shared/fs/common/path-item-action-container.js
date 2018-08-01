// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type TypedState,
  type Dispatch,
} from '../../util/container'
import PathItemAction from './path-item-action'
import {fileUIName, isMobile, isIOS, isAndroid} from '../../constants/platform'
import {OverlayParentHOC} from '../../common-adapters'
import {copyToClipboard} from '../../util/clipboard'
import {type MenuItem} from '../../common-adapters/popup-menu'

type OwnProps = {
  path: Types.Path,
  actionIconClassName?: string,
  actionIconFontSize?: number,
}

const mapStateToProps = (state: TypedState) => ({
  _pathItems: state.fs.pathItems,
  _tlfs: state.fs.tlfs,
  _username: state.config.username || undefined,
  _fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
})

const mapDispatchToProps = (dispatch: Dispatch, {path}: OwnProps) => ({
  loadFolderList: () => dispatch(FsGen.createFolderListLoad({path, refreshTag: 'path-item-action-popup'})),
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path, refreshTag: 'path-item-action-popup'})),
  ignoreFolder: () => dispatch(FsGen.createFavoriteIgnore({path})),
  copyPath: () => copyToClipboard(Types.pathToString(path)),
  ...(isMobile
    ? {
        _saveMedia: () => dispatch(FsGen.createSaveMedia({path})),
        _shareNative: () => dispatch(FsGen.createShareNative({path})),
      }
    : {
        _showInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
      }),

  ...(!isIOS
    ? {
        _download: () => dispatch(FsGen.createDownload({path, intent: 'none'})),
      }
    : {}),
})

type MenuItemAppender = (
  menuItems: Array<MenuItem>,
  stateProps: $Call<typeof mapStateToProps, TypedState>,
  dispatchProps: $Call<typeof mapDispatchToProps, Dispatch, OwnProps>,
  path: Types.Path
) => any

const aShowIn: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) =>
  !isMobile && stateProps._fileUIEnabled
    ? [
        ...menuItems,
        {
          title: 'Show in ' + fileUIName,
          onClick: dispatchProps._showInFileUI,
        },
      ]
    : menuItems

const aCopyPath: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) => [
  ...menuItems,
  {
    title: 'Copy path',
    onClick: dispatchProps.copyPath,
  },
]

const aIgnore: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) =>
  Constants.showIgnoreFolder(path, stateProps._username)
    ? [
        ...menuItems,
        {
          title: 'Ignore this folder',
          onClick: dispatchProps.ignoreFolder,
          subTitle: 'The folder will no longer appear in your folders list.',
          danger: true,
        },
      ]
    : menuItems

const aSave: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) => {
  const pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  return isMobile && pathItem.type !== 'folder' && Constants.isMedia(pathItem)
    ? [
        ...menuItems,
        {
          title: 'Save',
          onClick: dispatchProps._saveMedia,
        },
      ]
    : menuItems
}

const aShareNative: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) =>
  isMobile && stateProps._pathItems.get(path, Constants.unknownPathItem).type === 'file'
    ? [
        ...menuItems,
        {
          title: 'Send to other app',
          onClick: dispatchProps._shareNative,
        },
      ]
    : menuItems

const aDownload: MenuItemAppender = (menuItems, stateProps, dispatchProps, path) =>
  !isMobile || (isAndroid && stateProps._pathItems.get(path, Constants.unknownPathItem).type !== 'folder')
    ? [
        ...menuItems,
        {
          title: 'Download a copy',
          onClick: dispatchProps._download,
        },
      ]
    : menuItems

const tlfListAppenders: Array<MenuItemAppender> = [aShowIn, aCopyPath]
const tlfAppenders: Array<MenuItemAppender> = [aShowIn, aIgnore, aCopyPath]
const inTlfAppenders: Array<MenuItemAppender> = [aShowIn, aSave, aShareNative, aDownload, aCopyPath]

const getRootMenuItemsByAppenders = (
  appenders: Array<MenuItemAppender>,
  stateProps,
  dispatchProps,
  path: Types.Path
) =>
  appenders.reduce(
    (menuItems: Array<MenuItem>, appender: MenuItemAppender) =>
      appender(menuItems, stateProps, dispatchProps, path),
    ([]: Array<MenuItem>)
  )

const getRootMenuItemsByPathLevel = (pathLevel: number, stateProps, dispatchProps, path: Types.Path) => {
  switch (pathLevel) {
    case 0:
      // The action is for `/`. This shouldn't be possible.
      return []
    case 1:
      // The action is for `/keybase`. This shouldn't be possible as we never
      // have a /keybase row, and we don't show ... menu for root view.
      return []
    case 2:
      // The action is for a tlf list, i.e. /keybase/private, /keybase/public,
      // or /keybase/team.
      return getRootMenuItemsByAppenders(tlfListAppenders, stateProps, dispatchProps, path)
    case 3:
      // The action is for a tlf.
      return getRootMenuItemsByAppenders(tlfAppenders, stateProps, dispatchProps, path)
    default:
      // The action is for something inside a tlf
      return getRootMenuItemsByAppenders(inTlfAppenders, stateProps, dispatchProps, path)
  }
}

const mergeProps = (stateProps, dispatchProps, {path, actionIconClassName, actionIconFontSize}) => {
  const pathElements = Types.getPathElements(path)
  const menuItems = getRootMenuItemsByPathLevel(pathElements.length, stateProps, dispatchProps, path)
  const {_pathItems, _username} = stateProps
  const {loadFolderList, loadMimeType} = dispatchProps
  const pathItem = _pathItems.get(path, Constants.unknownPathItem)
  const type = pathElements.length <= 3 ? 'folder' : pathItem.type
  const {childrenFolders, childrenFiles} =
    !pathItem || type !== 'folder' || !pathItem.children
      ? {childrenFolders: 0, childrenFiles: 0}
      : pathItem.children.reduce(
          ({childrenFolders, childrenFiles}, p) => {
            const isFolder =
              _pathItems.get(Types.pathConcat(path, p), Constants.unknownPathItem).type === 'folder'
            return {
              childrenFolders: childrenFolders + (isFolder ? 1 : 0),
              childrenFiles: childrenFiles + (isFolder ? 0 : 1),
            }
          },
          {childrenFolders: 0, childrenFiles: 0}
        )
  const itemStyles = Constants.getItemStyles(pathElements, type, _username)
  return {
    type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter.username,
    name: pathElements[pathElements.length - 1],
    size: pathItem.size,
    needLoadMimeType: type === 'file' && pathItem.mimeType === '',
    needFolderList: type === 'folder' && pathElements.length >= 3,
    childrenFolders,
    childrenFiles,
    pathElements,
    itemStyles,
    menuItems,
    loadMimeType,
    loadFolderList,
    actionIconClassName,
    actionIconFontSize,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedPathItemAction'),
  OverlayParentHOC,
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!this.props.showingMenu || (prevProps.showingMenu && this.props.path === prevProps.path)) {
        return
      }
      // TODO: get rid of these when we have notifications in place.
      this.props.needFolderList && this.props.loadFolderList()
      this.props.needLoadMimeType && this.props.loadMimeType()
    },
  })
)(PathItemAction)
