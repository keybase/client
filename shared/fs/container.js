// @flow
import * as I from 'immutable'
import {connect, type TypedState, type Dispatch} from '../util/container'
import * as FSGen from '../actions/fs-gen'
import Files from '.'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

type StateProps = {
  you: ?string,
  path: Types.Path,
  items: I.List<string>,
  pathItems: I.Map<Path, PathItem>,
}

type DispatchProps = {
  _onViewFolder: (path: Types.Path) => () => void,
  _onViewFile: (path: Types.Path) => () => void,
  onBack: () => void | null,
}

const mapStateToProps = (state: TypedState, ownProps) => {
  const path = ownProps.routeProps.get('path', Constants.defaultPath)
  return {
    you: state.config.username,
    path: path,
    items: state.fs.getIn(['pathItems', path, 'children'], I.List()),
    pathItems: state.fs.pathItems,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onViewFolder: (path: Types.Path) => () => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
  onViewFile: (path: Types.Path) => () => console.log("Cannot view files yet. Requested file: " + path),
  onBack: () => dispatch(navigateUp()),
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
  ...dispatchProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Files)
