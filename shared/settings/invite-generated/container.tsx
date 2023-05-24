import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InviteGenerated from '.'

type OwnProps = {
  email?: string
  link: string
}

export default (ownProps: OwnProps) => {
  const {link, email} = ownProps
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {email, link, onClose}
  return <InviteGenerated {...props} />
}
