// @flow
import Offline from '.'
import {connect} from '../util/container'

const mapStateToProps = state => ({
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachable,
})

export default connect(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(Offline)
