import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import Normal from './normal/container'
import Preview from './preview/container'
import {connect, isMobile} from '../../../util/container'
import ThreadSearch from '../search/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

type Props = {
  isPreview: boolean
  noInput: boolean
  showThreadSearch: boolean
} & OwnProps

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  let noInput = !meta.resetParticipants.isEmpty() || !!meta.wasFinalizedBy
  const showThreadSearch = Constants.getThreadSearchInfo(state, conversationIDKey).visible

  if (
    conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    conversationIDKey === Constants.pendingErrorConversationIDKey
  ) {
    noInput = true
  }

  return {
    conversationIDKey,
    isPreview: meta.membershipType === 'youArePreviewing',
    noInput,
    showThreadSearch,
  }
}

class InputArea extends React.PureComponent<Props> {
  render() {
    if (this.props.noInput) {
      return null
    }
    if (this.props.isPreview) {
      return <Preview conversationIDKey={this.props.conversationIDKey} />
    }
    if (this.props.showThreadSearch && isMobile) {
      return <ThreadSearch conversationIDKey={this.props.conversationIDKey} />
    }
    return (
      <Normal
        focusInputCounter={this.props.focusInputCounter}
        jumpToRecent={this.props.jumpToRecent}
        onRequestScrollDown={this.props.onRequestScrollDown}
        onRequestScrollToBottom={this.props.onRequestScrollToBottom}
        onRequestScrollUp={this.props.onRequestScrollUp}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

export default connect(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(InputArea)
