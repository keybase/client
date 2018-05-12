// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {isMobile} from '../../constants/platform'
import {navigateAppend} from '../../actions/route-tree'
import {Row} from './row'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
    pathItem,
  }
}

const isBare = (path: Types.Path) => isMobile && ['image'].includes(Constants.viewTypeFromPath(path))

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      dispatch(navigateAppend([{props: {path}, selected: isBare(path) ? 'barePreview' : 'preview'}]))
    }
  },
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _onAction: (path: Types.Path, type: Types.PathType, evt?: SyntheticEvent<>) =>
    dispatch(
      FsGen.createFileActionPopup({
        path,
        type,
        targetRect: Constants.syntheticEventToTargetRect(evt),
        routePath,
      })
    ),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  name: stateProps.pathItem.name,
  type: stateProps.pathItem.type,
  badgeCount: stateProps.pathItem.badgeCount,
  tlfMeta: stateProps.pathItem.tlfMeta,
  lastModifiedTimestamp: stateProps.pathItem.lastModifiedTimestamp,
  lastWriter: stateProps.pathItem.lastWriter.username,
  shouldShowMenu:
    !isMobile ||
    stateProps.pathItem.type !== 'folder' ||
    Constants.showIgnoreFolder(stateProps.path, stateProps.pathItem, stateProps._username),
  onOpen: () => dispatchProps._onOpen(stateProps.pathItem.type, stateProps.path),
  openInFileUI: stateProps.kbfsEnabled
    ? () => dispatchProps._openInFileUI(stateProps.path)
    : dispatchProps._openFinderPopup,
  onAction: (event: SyntheticEvent<>) =>
    dispatchProps._onAction(stateProps.path, stateProps.pathItem.type, event),
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(stateProps.path),
    stateProps.pathItem.type,
    stateProps._username
  ),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FileRow'))(
  Row
)
