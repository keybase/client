// @flow
import Files from './index'
import * as FsGen from '../../actions/fs-gen'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => {
  const kbfsEnabled = state.fs.fuseStatus && state.fs.fuseStatus.kextStarted
  return {
    kbfsEnabled,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
  onInstall: () => undefined,
  onUninstall: () => undefined,
})

const mergeProps = ({kbfsEnabled}, dispatchProps) => ({
  kbfsEnabled,
  ...dispatchProps,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props.getFuseStatus()
    },
  })
)(Files)
