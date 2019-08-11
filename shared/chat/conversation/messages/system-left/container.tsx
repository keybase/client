import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import Joined from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemLeft
}

export default connect(
  (state, {message}: OwnProps) => {
    const meta = Constants.getMeta(state, message.conversationIDKey)
    return {
      channelname: meta.channelname,
      isBigTeam: meta.teamType === 'big',
      leavers: [message.author],
      teamname: meta.teamname,
      timestamp: message.timestamp,
    }
  },
  () => ({}),
  (stateProps, _, __: OwnProps) => stateProps
)(Joined)
