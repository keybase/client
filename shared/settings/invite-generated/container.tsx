import * as C from '../../constants'
import InviteGenerated from '.'

type OwnProps = {
  email?: string
  link: string
}

export default (ownProps: OwnProps) => {
  const {link, email} = ownProps
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onClose = () => {
    navigateUp()
  }
  const props = {email, link, onClose}
  return <InviteGenerated {...props} />
}
