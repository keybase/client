// @flow
import {connect, type TypedState, type Dispatch} from '../util/container'
import * as FSGen from '../actions/fs-gen'
import Files from '.'
import {navigateAppend} from '../actions/route-tree'
import * as Types from '../constants/types/fs'

type StateProps = {
  you: ?string,
  path: Types.Path,
  items: I.List<string>,
  pathItems: I.Map<Path, PathItem>,
}

type DispatchProps = {
  onViewFolder: (path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, ownProps): StateProps => {
  var path = state.fs.defaultPath
  if (ownProps.routeProps) {
    path = ownProps.routeProps.get('path', path)
  }
  const items = state.fs.pathItems.get(path).children
  return {
    you: state.config.username,
    path: path,
    items: items,
    pathItems: state.fs.pathItems,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onViewFolder: (path: Types.Path) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  name: Types.getPathName(stateProps.path),
  path: stateProps.path,
  visibility: Types.getPathVisibility(stateProps.path),
  items: stateProps.items.map(name => {
    const path = Types.pathConcat(stateProps.path, name)
    const item = stateProps.pathItems.get(path)
    return {
      name: name,
      path: path,
      type: item.type,
      visibility: Types.getPathVisibility(path),
    }
  }).toArray(),
  onViewFolder: dispatchProps.onViewFolder,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Files)
