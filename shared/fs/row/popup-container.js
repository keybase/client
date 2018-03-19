// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import Popup from './popup'
import {fileUIName} from '../../constants/platform'
import {isMobile} from '../../styles'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = routeProps.get('path')
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  // We need to do this counting here since it's possible between this
  // mapStateProps and last mapStateProps call, pathItem.children reamined the
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
    _username,
    childrenFolders,
    childrenFiles,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showInFileUI: (path: Types.Path) => dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
  download: (path: Types.Path) => dispatch(FSGen.createDownload({path})),
  onHidden: () => dispatch(navigateUp()),
})

const mergeProps = (
  {path, pathItem, _username, childrenFolders, childrenFiles, fileUIEnabled},
  {showInFileUI, download, onHidden}
) => {
  const itemStyles = Constants.getItemStyles(Types.getPathElements(path), pathItem.type, _username)
  return {
    type: pathItem ? pathItem.type : 'unknown',
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter.username,
    name: pathItem.name,
    size: pathItem.size,
    childrenFolders,
    childrenFiles,
    itemStyles,
    menuItems: (fileUIEnabled
      ? [
          {
            title: 'Show in ' + fileUIName,
            onClick: () => showInFileUI(path),
          },
        ]
      : []
    ).concat(
      !isMobile
        ? [
            {
              title: 'Download a copy',
              onClick: () => download(path),
            },
          ]
        : []
    ),
    onHidden,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Popup'))(
  Popup
)
