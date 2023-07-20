import * as RouterConstants from '../../constants/router2'
import InviteGenerated from '.'

type OwnProps = {
  email?: string
  link: string
}

export default (ownProps: OwnProps) => {
  const {link, email} = ownProps
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onClose = () => {
    navigateUp()
  }
  const props = {email, link, onClose}
  return <InviteGenerated {...props} />
}
