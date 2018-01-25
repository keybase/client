// @flow
import * as I from 'immutable'
import {connect, type TypedState, type Dispatch} from '../util/container'
import * as FSGen from '../actions/fs-gen'
import Files from '.'
import {navigateAppend, navigateUp} from '../actions/route-tree'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

type OwnProps = {
  routeProps: I.Map<'path', string>,
}

type StateProps = {
  path: Types.Path,
  items: I.List<string>,
}

type DispatchProps = {
  onBack: () => void | null,
}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = routeProps.get('path', Constants.defaultPath)
  return {
    path: path,
    items: state.fs.getIn(['pathItems', path, 'children'], I.List()).map(name => Types.pathConcat(path, name)),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = ({path, items}: StateProps, dispatchProps: DispatchProps) => ({
  path,
  items: items.toArray(),
  /* TODO: enable these once we need them:
  name: Types.getPathName(stateProps.path),
  visibility: Types.getPathVisibility(stateProps.path),
  */
  ...dispatchProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Files)
