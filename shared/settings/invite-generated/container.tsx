import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = Container.RouteProps<'inviteSent'>

export default Container.connect(
  (_, ownProps: OwnProps) => ({
    email: ownProps.route.params?.email ?? '',
    link: ownProps.route.params?.link ?? '',
  }),
  dispatch => ({onClose: () => dispatch(RouteTreeGen.createNavigateUp())}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(InviteGenerated)
