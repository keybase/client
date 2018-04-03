// @flow
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import {connect, type TypedState} from '../../../util/container'

type Props = {
  showResetParticipants: Types.ConversationIDKey | null,
  showSuperseded: Types.ConversationIDKey | null,
}

class BottomMessage extends React.PureComponent<Props> {
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
  conversationIDKey: Types.ConversationIDKey,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  const showResetParticipants = meta && !meta.resetParticipants.isEmpty() ? ownProps.conversationIDKey : null
  const showSuperseded =
    meta && (meta.wasFinalizedBy || meta.supersededBy) ? ownProps.conversationIDKey : null

  return {
    showResetParticipants,
    showSuperseded,
  }
}
const mapDispatchToProps = (dispatch: Dispatch) => ({})
const mergeProps = (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BottomMessage)
