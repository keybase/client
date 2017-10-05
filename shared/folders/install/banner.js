// @flow
import {
  compose,
  renderComponent,
  branch,
  type TypedState,
  connect,
  type MapStateToProps,
} from '../../util/container'
import Install from './banner-install'
import Uninstall from './banner-uninstall'

const mapStateToProps: MapStateToProps<*, *, *> = (state: TypedState) => {
  const installed = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  return {
    installed,
  }
}

export default compose(
  connect(mapStateToProps),
  branch(props => props.installed, renderComponent(Uninstall))
)(Install)
