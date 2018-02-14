// @flow
import * as I from 'immutable'
import {compose, connect, lifecycle, setDisplayName, type Dispatch, type TypedState} from '../util/container'
import Files from '.'
import * as FsGen from '../actions/fs-gen'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

type OwnProps = {
  routeProps: I.Map<'path', string>,
}

type StateProps = {
  path: Types.Path,
  items: I.List<Types.Path>,
  progress: Types.ProgressType,
}

type DispatchProps = {}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const itemDetail = state.fs.pathItems.get(path)
  const items = itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.List()) : I.List()
  const progress: Types.ProgressType = itemDetail ? itemDetail.progress : 'pending'
  return {items, path, progress}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
})

const mergeProps = ({path, items, progress}: StateProps, dispatchProps: DispatchProps, ownProps) => ({
  items: items.map(name => Types.pathConcat(path, Types.pathToString(name))).toArray(),
  progress,
  path,
  /* TODO: enable these once we need them:
  name: Types.getPathName(stateProps.path),
  visibility: Types.getPathVisibility(stateProps.path),
  */
  ...dispatchProps,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props._loadFolderList(this.props.path)
    },
  }),
  setDisplayName('Files')
)(Files)
