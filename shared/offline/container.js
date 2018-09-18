// @flow
import Offline from '.'
import {connect, type TypedState} from '../util/container'

const mapStateToProps = (state: TypedState) => ({
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachable,
})

export default connect(mapStateToProps, () => ({}), (s, d, o) => ({...o, ...s, ...d}))(Offline)
