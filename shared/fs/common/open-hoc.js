// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'

type OwnProps = {
  routePath: I.List<string>,
  path: Types.Path,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  _kbfsEnabled: Constants.kbfsEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}: OwnProps) => ({
  onOpen: () => dispatch(FsGen.createOpenPathItem({path, routePath})),
  _openInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = ({_kbfsEnabled}, dispatchProps, ownProps) => ({
  onOpen: dispatchProps.onOpen,
  openInFileUI: _kbfsEnabled ? dispatchProps._openInFileUI : dispatchProps._openFinderPopup,
  ...ownProps,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedOpenHOC')
)
