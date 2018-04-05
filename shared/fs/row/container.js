// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {Row} from './row'
import {isMobile, isLinux} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    kbfsEnabled: isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted),
    pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      dispatch(navigateAppend([{props: {path}, selected: 'preview'}]))
    }
  },
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _onAction: (path: Types.Path, type: Types.PathType, targetRect?: ?ClientRect) => {
    // We may not have the folder loaded yet, but will need metadata to know
    // folder entry types in the popup. So dispatch an action now to load it.
    type === 'folder' && dispatch(FsGen.createFolderListLoad({path}))
    dispatch(
      navigateAppend([
        {
          props: {
            path,
            position: 'bottom right',
            isShare: false,
            targetRect,
          },
          selected: 'rowAction',
        },
      ])
    )
  },
  _openFinderPopup: isMobile
    ? () => undefined
    : (evt?: SyntheticEvent<>) =>
        dispatch(
          navigateAppend([
            {
              props: {
                targetRect: evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
                position: 'bottom right',
                onHidden: () => dispatch(navigateUp()),
                onInstall: () => dispatch(FsGen.createInstallFuse()),
              },
              selected: 'finderAction',
            },
          ])
        ),
})

const mergeProps = (stateProps, dispatchProps) => ({
  name: stateProps.pathItem.name,
  type: stateProps.pathItem.type,
  lastModifiedTimestamp: stateProps.pathItem.lastModifiedTimestamp,
  lastWriter: stateProps.pathItem.lastWriter.username,
  onOpen: () => dispatchProps._onOpen(stateProps.pathItem.type, stateProps.path),
  openInFileUI: stateProps.kbfsEnabled
    ? () => dispatchProps._openInFileUI(stateProps.path)
    : dispatchProps._openFinderPopup,
  onAction: (event: SyntheticEvent<>) =>
    dispatchProps._onAction(
      stateProps.path,
      stateProps.pathItem.type,
      isMobile ? undefined : (event.target: window.HTMLElement).getBoundingClientRect()
    ),
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(stateProps.path),
    stateProps.pathItem.type,
    stateProps._username
  ),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FileRow'))(
  Row
)
