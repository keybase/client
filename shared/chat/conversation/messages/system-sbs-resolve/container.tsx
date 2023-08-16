import * as C from '../../../../constants'
import SystemInviteAccepted from '.'
import type * as T from '../../../../constants/types'

type OwnProps = {
  message: T.Chat.MessageSystemSBSResolved
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
