import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemSBSResolved
}

export default (ownProps: OwnProps) => {
  const {message} = ownProps
  const you = Container.useSelector(state => state.config.username)
  const props = {
    message,
    you,
  }
  return <SystemInviteAccepted {...props} />
}
