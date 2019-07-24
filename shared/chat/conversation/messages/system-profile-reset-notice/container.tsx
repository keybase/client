import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    prevConversationIDKey: meta.supersedes,
    username: meta.wasFinalizedBy || '',
  }
}

const mapDispatchToProps = dispatch => ({
  _onOpenOlderConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'jumpToReset'})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  onOpenOlderConversation: () => {
    stateProps.prevConversationIDKey &&
      dispatchProps._onOpenOlderConversation(stateProps.prevConversationIDKey)
  },
  username: stateProps.username,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ProfileResetNotice)
