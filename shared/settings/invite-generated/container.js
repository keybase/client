// @flow
import {connect} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import InviteGenerated from '.'

const mapStateToProps = (state: any, {routeProps}) => ({
  email: routeProps.get('email'),
  link: routeProps.get('link'),
})

const mapDispatchToProps = (dispatch: any) => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteGenerated)
