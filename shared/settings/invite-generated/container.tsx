import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = Container.RouteProps<{email: string; link: string}>

export default Container.connect(
  (_, ownProps: OwnProps) => ({
    email: Container.getRouteProps(ownProps, 'email', ''),
    link: Container.getRouteProps(ownProps, 'link', ''),
  }),
  dispatch => ({onClose: () => dispatch(RouteTreeGen.createNavigateUp())}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(InviteGenerated)
