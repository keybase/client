import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'
import * as ConfigConstants from '../../../../constants/config'

type OwnProps = {
  message: Types.MessageSystemSBSResolved
}

export default (ownProps: OwnProps) => {
  const {message} = ownProps
  const you = ConfigConstants.useConfigState(s => s.username)
  const props = {
    message,
    you,
  }
  return <SystemInviteAccepted {...props} />
}
