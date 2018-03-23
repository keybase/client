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
        shareNative: (path: Types.Path) => {
          dispatch(FSGen.createDownload({path, intent: 'share'}))
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
                selected: 'rowAction',
              },
            ])
          ),
      }
    : {
        showInFileUI: (path: Types.Path) =>
          dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
      }),

  ...(isIOS
    ? {
        download: (path: Types.Path) => dispatch(FSGen.createDownload({path, intent: 'none'})),
      }
    : {}),
})

const getRootMenuItems = (stateProps, dispatchProps) => {
  const {path, pathItem, fileUIEnabled} = stateProps
  const {showInFileUI, saveImage, share, download} = dispatchProps
  let menuItems = []
  if (!isMobile && fileUIEnabled) {
    menuItems.push({
      title: 'Show in ' + fileUIName,
      onClick: () => showInFileUI(path),
    })
  }
  if (isMobile) {
    if (Constants.isImage(pathItem.name)) {
      menuItems.push({
        title: 'Save',
        onClick: () => saveImage(path),
      })
    }
    menuItems.push({
      title: 'Share...',
      onClick: () => share(path),
    })
  }
  if (!isIOS) {
    // TODO make android download work
    menuItems.push({
      title: 'Download a copy',
      onClick: () => download(path),
    })
  }
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
