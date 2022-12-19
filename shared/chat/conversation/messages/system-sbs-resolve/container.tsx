import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemSBSResolved
}

export default connect(
  state => ({you: state.config.username}),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    message: ownProps.message,
    you: stateProps.you,
  })
)(SystemInviteAccepted)
