// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import Still from './still'

type OwnProps = $Diff<Types.StillRowItem, {rowType: 'still'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _username: state.config.username,
  _downloads: state.fs.downloads,
})

const mergeProps = (stateProps, dispatchProps, {name, path, routePath}: OwnProps) => {
  const {_downloads, _pathItem, _username} = stateProps
  const {type, lastModifiedTimestamp, lastWriter} = _pathItem
  return {
    isDownloading: !!_downloads.find(t => t.meta.path === path && !t.state.isDone),
    isEmpty: _pathItem.type === 'folder' && _pathItem.progress === 'loaded' && _pathItem.children.isEmpty(),
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), type, _username),
    lastModifiedTimestamp,
    lastWriter: lastWriter.username,
    name,
    path,
    routePath,
    type,
  }
}

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('ConnectedStillRow'),
  OpenHOC
)(Still)
