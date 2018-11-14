// @flow
import {connect, type RouteProps} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import InviteGenerated from '.'

type OwnProps = RouteProps<{email: string, link: string}, {}>

const mapStateToProps = (state: any, {routeProps}) => ({
  email: routeProps.get('email'),
  link: routeProps.get('link'),
})

const mapDispatchToProps = (dispatch: any) => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteGenerated)
