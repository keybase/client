import {connect, RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = RouteProps<{email: string; link: string}>

const mapStateToProps = (_: any, {routeProps}) => ({
  email: routeProps.get('email'),
  link: routeProps.get('link'),
})

const mapDispatchToProps = (dispatch: any) => ({
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(InviteGenerated)
