// @flow
import Offline from '.'
import {connect, type TypedState} from '../util/container'

const mapStateToProps = (state: TypedState) => ({
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachability.reachable,
})

export default connect(mapStateToProps, () => ({}))(Offline)
