// @flow
import * as I from 'immutable'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type Dispatch,
  type TypedState,
} from '../../util/container'
import FilePreview from '.'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = {
  routeProps: I.Map<'path', string>,
}

type StateProps = {
  path: Types.Path,
  meta: ?Types.PathItemMetadata,
}

type DispatchProps = {
  loadFilePreview: (path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const meta = state.fs.metas.get(path)
  return {
    path,
    meta,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadFilePreview: (path: Types.Path) => dispatch(FsGen.createFilePreviewLoad({path})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => {
  return {
    path: stateProps.path,
    meta: stateProps.meta,

    loadFilePreview: dispatchProps.loadFilePreview,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props.loadFilePreview(this.props.path)
    },
  }),
  setDisplayName('FilePreview')
)(FilePreview)
