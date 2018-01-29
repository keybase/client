// @flow
// import OldProfileResetNotice from '../notices/old-profile-reset-notice/container'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import Normal from './normal/container'
import Preview from './preview/container'
import {connect} from '../../../util/container'
import type {TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}): * => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    conversationIDKey,
    isPreview: false, // TODO
    isReset: !meta.resetParticipants.isEmpty(),
  }
}

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  isPreview: boolean,
  isReset: boolean,
  onScrollDown: () => void,
}

class InputArea extends React.PureComponent<Props> {
  render() {
    // TODO
    // const input = this.props.finalizeInfo ? (
    // <OldProfileResetNotice />

    if (this.props.isReset) {
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

export default connect(mapStateToProps)(InputArea)
