// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import Normal from './normal/container'
import Preview from './preview/container'
import {connect} from '../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  onScrollDown: () => void,
|}
type Props = {|
  ...OwnProps,
  isPreview: boolean,
  noInput: boolean,
|}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  let noInput = !meta.resetParticipants.isEmpty() || !!meta.wasFinalizedBy
  let conversationIDKeyToShow = conversationIDKey

  if (conversationIDKey === Constants.pendingConversationIDKey) {
    const resolved = Constants.getResolvedPendingConversationIDKey(state)
    if (!Constants.isValidConversationIDKey(resolved)) {
      noInput = true
    } else {
      conversationIDKeyToShow = resolved
    }
  } else if (conversationIDKey === Constants.pendingWaitingConversationIDKey) {
    noInput = true
  }

  return {
    conversationIDKey: conversationIDKeyToShow,
    isPreview: meta.membershipType === 'youArePreviewing',
    noInput,
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
    return (
      <Normal
        focusInputCounter={this.props.focusInputCounter}
        onScrollDown={this.props.onScrollDown}
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
