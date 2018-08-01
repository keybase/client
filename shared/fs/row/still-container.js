// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Still from './still'
import * as StateMappers from '../utils/state-mappers'

type OwnProps = $Diff<Types.StillRowItem, {rowType: 'still'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  const _pathItem: Types.PathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  const _username = state.config.username || undefined
  const _downloads = state.fs.downloads
  return {
    _downloads,
    _kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
    _pathItem,
    _username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}: OwnProps) => ({
  onOpen: () => dispatch(FsGen.createOpenPathItem({path, routePath})),
  _openInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = (stateProps, dispatchProps, {name, path}: OwnProps) => {
  const {_downloads, _kbfsEnabled, _pathItem, _username} = stateProps
  const {onOpen, _openInFileUI, _openFinderPopup} = dispatchProps
  const {type, lastModifiedTimestamp, lastWriter} = _pathItem
  return {
    isDownloading: !!_downloads.find(t => t.meta.path === path && !t.state.isDone),
    isEmpty: _pathItem.type === 'folder' && _pathItem.progress === 'loaded' && _pathItem.children.isEmpty(),
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), type, _username),
    lastModifiedTimestamp,
    lastWriter: lastWriter.username,
    name,
    path,
    type,
    onOpen,
    openInFileUI: _kbfsEnabled ? _openInFileUI : _openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedStillRow')
)(Still)
