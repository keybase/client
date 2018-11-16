// @flow
import Offline from '.'
import {connect} from '../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  appFocused: state.config.appFocused,
  reachable: state.gregor.reachable,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(Offline)
