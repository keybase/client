// @flow
import {compose, renderComponent, branch, type TypedState, connect} from '../../util/container'
import Install from './banner-install'
import Uninstall from './banner-uninstall'
import {isWindows} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => {
  // on Windows, check that the driver is up to date too
  const installed = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted &&
    !(isWindows && state.favorite.fuseStatus.installAction === 2)

  return {
    installed,
  }
}

export default compose(
  connect(mapStateToProps),
  branch(props => props.installed, renderComponent(Uninstall))
)(Install)
