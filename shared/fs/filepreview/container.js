// @flow
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

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => ({
  path: stateProps.path,
  meta: stateProps.meta,
  loadFilePreview: dispatchProps.loadFilePreview,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreview'),
  lifecycle({
    componentWillMount() {
      this.props.loadFilePreview(this.props.path)
    },
  })
)(FilePreview)
