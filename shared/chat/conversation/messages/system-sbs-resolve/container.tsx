import * as C from '../../../../constants'
import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {
  message: Types.MessageSystemSBSResolved
}

export default (ownProps: OwnProps) => {
  const {message} = ownProps
  const you = C.useCurrentUserState(s => s.username)
  const props = {
    message,
    you,
  }
  return <SystemInviteAccepted {...props} />
}
