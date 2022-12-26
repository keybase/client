import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import * as Container from '../../../util/container'

type Props = {
  showResetParticipants: Types.ConversationIDKey | null
  showSuperseded: Types.ConversationIDKey | null
  measure: (() => void) | null
}

class BottomMessage extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (
      this.props.measure &&
      (this.props.showResetParticipants !== prevProps.showResetParticipants ||
        this.props.showSuperseded !== prevProps.showSuperseded)
    ) {
      this.props.measure()
    }
  }
  render() {
    if (this.props.showResetParticipants) {
      return <ResetUser conversationIDKey={this.props.showResetParticipants} />
    }
    if (this.props.showSuperseded) {
      return <OldProfileReset conversationIDKey={this.props.showSuperseded} />
    }
    return null
  }
}

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure: (() => void) | null
}

const BottomMessageContainer = React.memo(function BottomMessageContainer(p: OwnProps) {
  const {conversationIDKey, measure} = p
  const showResetParticipants = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    return meta.resetParticipants.size !== 0
  })
  const showSuperseded = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    return !!meta.wasFinalizedBy || meta.supersededBy !== Constants.noConversationIDKey
  })

  const props = {
    measure,
    showResetParticipants: showResetParticipants ? conversationIDKey : null,
    showSuperseded: showSuperseded ? conversationIDKey : null,
  }
  return <BottomMessage {...props} />
})
export default BottomMessageContainer
