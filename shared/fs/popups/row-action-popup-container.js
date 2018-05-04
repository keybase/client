// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import Popup from './row-action-popup'
import {fileUIName, isMobile, isIOS} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = routeProps.get('path')
  const isShare = routeProps.get('isShare')
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  // We need to do this counting here since it's possible between this
  // mapStateProps and last mapStateProps call, pathItem.children remained the
  // same, but some of the children changed from folder to file or vice versa.
  // If we did it in mergeProps, we wouldn't be able capture that change.
  const [childrenFolders, childrenFiles] =
    !pathItem || pathItem.type !== 'folder'
      ? [0, 0]
      : pathItem.children.reduce(
          ([currentFolders, currentFiles], p) => {
            const pi = state.fs.pathItems.get(Types.pathConcat(path, p))
            if (!pi) {
              return [currentFolders, currentFiles]
            }
            return pi.type === 'folder'
              ? [currentFolders + 1, currentFiles]
              : [currentFolders, currentFiles + 1]
          },
          [0, 0]
        )

  return {
    _fileName: pathItem.name,
    path,
    pathItem,
    isShare,
    _username,
    childrenFolders,
    childrenFiles,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onHidden: () => dispatch(navigateUp()),
  _ignoreFolder: (path: Types.Path) => {
    dispatch(FSGen.createFavoriteIgnore({path}))
    !isMobile && dispatch(navigateUp())
  },

  ...(isMobile
    ? {
        saveImage: (path: Types.Path) => {
          dispatch(FSGen.createDownload({path, intent: 'camera-roll'}))
          dispatch(
            navigateAppend([
              {
                props: {path, isShare: true},
                selected: 'transferPopup',
              },
            ])
          )
        },
        share: (path: Types.Path) =>
          dispatch(
            navigateAppend([
              {
                props: {path, isShare: true},
                selected: 'pathItemAction',
              },
            ])
          ),
        shareNative: (path: Types.Path) => {
          dispatch(FSGen.createDownload({intent: 'share', path}))
          dispatch(
            navigateAppend([
              {
                props: {path, isShare: true},
                selected: 'transferPopup',
              },
            ])
          )
        },
      }
    : {
        showInFileUI: (path: Types.Path) =>
          dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
      }),

  ...(!isIOS
    ? {
        download: (path: Types.Path) => dispatch(FSGen.createDownload({path, intent: 'none'})),
      }
    : {}),
})

const getRootMenuItems = (stateProps, dispatchProps) => {
  const {path, pathItem, fileUIEnabled, _username} = stateProps
  const {showInFileUI, saveImage, share, download, _ignoreFolder} = dispatchProps
  const visibility = Types.getPathVisibility(path)
  let menuItems = []
  !isMobile &&
    fileUIEnabled &&
    menuItems.push({
      title: 'Show in ' + fileUIName,
      onClick: () => showInFileUI(path),
    })
  isMobile &&
    Constants.isMedia(pathItem.name) &&
    menuItems.push({
      title: 'Save',
      onClick: () => saveImage(path),
    })
  isMobile &&
    menuItems.push({
      title: 'Share...',
      onClick: () => share(path),
    })
  // TODO make android download work
  !isIOS &&
    menuItems.push({
      title: 'Download a copy',
      onClick: () => download(path),
    })
  !!pathItem.tlfMeta &&
    ['public', 'private'].includes(visibility) &&
    Types.getPathName(path) !== _username &&
    menuItems.push({
      title: 'Ignore this folder',
      onClick: () => _ignoreFolder(path),
      subTitle: 'The folder will no longer appear in your folders list.',
      danger: true,
    })
  return menuItems
}

const getShareMenuItems = ({path}, {shareNative}) =>
  isMobile
    ? [
        {
          title: 'Send to other app',
          onClick: () => shareNative(path),
        },
      ]
    : []

const mergeProps = (stateProps, dispatchProps) => {
  const {path, pathItem, isShare, _username, childrenFolders, childrenFiles} = stateProps
  const {onHidden} = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(path), pathItem.type, _username)
  const menuItems = isShare
    ? getShareMenuItems(stateProps, dispatchProps)
    : getRootMenuItems(stateProps, dispatchProps)
  return {
    type: pathItem.type || 'unknown',
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter.username,
    name: pathItem.name,
    size: pathItem.size,
    childrenFolders,
    childrenFiles,
    itemStyles,
    menuItems,
    onHidden,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Popup'))(
  Popup
)
