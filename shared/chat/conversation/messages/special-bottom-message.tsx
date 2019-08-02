import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import {namedConnect} from '../../../util/container'

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

const mapStateToProps = (state, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  const showResetParticipants = !meta.resetParticipants.isEmpty() ? ownProps.conversationIDKey : null
  const showSuperseded =
    meta && (meta.wasFinalizedBy || meta.supersededBy !== Constants.noConversationIDKey)
      ? ownProps.conversationIDKey
      : null

  return {
    measure: ownProps.measure,
    showResetParticipants,
    showSuperseded,
  }
}
const mapDispatchToProps = () => ({})
const mergeProps = (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'BottomMessage')(
  BottomMessage
) as any
