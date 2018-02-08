// @flow
import * as I from 'immutable'
import {compose, connect, type TypedState, setDisplayName, type Dispatch} from '../util/container'
import Files from '.'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

type OwnProps = {
  routeProps: I.Map<'path', string>,
}

type StateProps = {
  path: Types.Path,
  items: I.List<Types.Path>,
}

type DispatchProps = {}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const itemDetail = state.fs.pathItems.get(path)
  const items = itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.List()) : I.List()
  return {
    items: items.map(name => Types.pathConcat(path, name)),
    path: path,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = ({path, items}: StateProps, dispatchProps: DispatchProps, ownProps) => ({
  items: items.toArray(),
  path,
  /* TODO: enable these once we need them:
  name: Types.getPathName(stateProps.path),
  visibility: Types.getPathVisibility(stateProps.path),
  */
  ...dispatchProps,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Files'))(
  Files
)
