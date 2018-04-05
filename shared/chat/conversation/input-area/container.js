// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import Normal from './normal/container'
import Preview from './preview/container'
import PendingFailed from './pending-failed/container'
import {connect} from '../../../util/container'
import type {TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}): * => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const isPendingConversation = state.chat2.pendingSelected
  const pendingStatus = state.chat2.pendingStatus
  return {
    conversationIDKey,
    isPendingFailed: isPendingConversation && pendingStatus === 'failed',
    isPreview: meta.membershipType === 'youArePreviewing',
    noInput: !meta.resetParticipants.isEmpty() || !!meta.wasFinalizedBy,
  }
}

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  isPendingFailed: boolean,
  isPreview: boolean,
  noInput: boolean,
  onScrollDown: () => void,
}

class InputArea extends React.PureComponent<Props> {
  render() {
    if (this.props.noInput) {
      return null
    }
    if (this.props.isPendingFailed) {
      return <PendingFailed />
    }
    if (this.props.isPreview) {
      return <Preview conversationIDKey={this.props.conversationIDKey} />
    }
    return (
      <Normal
        focusInputCounter={this.props.focusInputCounter}
        onScrollDown={this.props.onScrollDown}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

export default connect(mapStateToProps)(InputArea)
