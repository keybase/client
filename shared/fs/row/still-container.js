// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {isMobile} from '../../constants/platform'
import Still from './still'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  const _transfers = state.fs.transfers
  return {
    _username,
    _transfers,
    path,
    kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
    pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _onOpen: (path: Types.Path) => dispatch(FsGen.createOpenPathItem({path, routePath})),
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

const mergeProps = (stateProps, dispatchProps) => {
  const resetParticipants =
    stateProps.pathItem.type === 'folder' &&
    !!stateProps.pathItem.tlfMeta &&
    stateProps.pathItem.tlfMeta.resetParticipants.length > 0
      ? stateProps.pathItem.tlfMeta.resetParticipants.map(i => i.username)
      : []
  return {
    name: stateProps.pathItem.name,
    type: stateProps.pathItem.type,
    badgeCount: stateProps.pathItem.badgeCount,
    isDownloading: !!stateProps._transfers.find(
      t => t.meta.type === 'download' && t.meta.path === stateProps.path && !t.state.isDone
    ),
    tlfMeta: stateProps.pathItem.tlfMeta,
    isUserReset: resetParticipants.includes(stateProps._username),
    resetParticipants,
    lastModifiedTimestamp: stateProps.pathItem.lastModifiedTimestamp,
    lastWriter: stateProps.pathItem.lastWriter.username,
    shouldShowMenu:
      !isMobile ||
      stateProps.pathItem.type !== 'folder' ||
      Constants.showIgnoreFolder(stateProps.path, stateProps.pathItem, stateProps._username),
    onOpen: () => dispatchProps._onOpen(stateProps.path),
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
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedStillRow')
)(Still)
