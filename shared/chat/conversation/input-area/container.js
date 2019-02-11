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
  isPending: boolean,
  onRequestScrollDown: () => void,
  onRequestScrollUp: () => void,
|}
type Props = {|
  ...OwnProps,
  isPreview: boolean,
  noInput: boolean,
|}

const mapStateToProps = (state, {conversationIDKey, isPending}: OwnProps) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  let noInput = !meta.resetParticipants.isEmpty() || !!meta.wasFinalizedBy

  if (isPending) {
    if (!Constants.isValidConversationIDKey(conversationIDKey)) {
      noInput = true
    }
  } else if (conversationIDKey === Constants.pendingWaitingConversationIDKey) {
    noInput = true
  }

  return {
    conversationIDKey,
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
        onRequestScrollDown={this.props.onRequestScrollDown}
        onRequestScrollUp={this.props.onRequestScrollUp}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(InputArea)
