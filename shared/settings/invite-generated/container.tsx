import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = Container.RouteProps2<'inviteSent'>

export default (ownProps: OwnProps) => {
  const {link, email} = ownProps.route.params
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {email, link, onClose}
  return <InviteGenerated {...props} />
}
