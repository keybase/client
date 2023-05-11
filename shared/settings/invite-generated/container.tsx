import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = Container.RouteProps<'inviteSent'>

export default (ownProps: OwnProps) => {
  const email = ownProps.route.params.email
  const link = ownProps.route.params.link
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    email,
    link,
    onClose,
  }
  return <InviteGenerated {...props} />
}
