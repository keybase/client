// @flow
import {compose, renderComponent, branch, type TypedState, connect} from '../../util/container'
import Install from './banner-install'
import Uninstall from './banner-uninstall'

const mapStateToProps = (state: TypedState): * => {
  const installed = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  return {
    installed,
  }
}

export default compose(
  connect(mapStateToProps),
  // $FlowIssue doesnt like sending down props not used
  branch(props => props.installed, renderComponent(Uninstall))
)(Install)
