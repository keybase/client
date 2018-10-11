// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import {connect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    prevConversationIDKey: meta.supersedes,
    username: meta.wasFinalizedBy || '',
  }
}

const mapDispatchToProps = (dispatch) => ({
  _onOpenOlderConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'jumpToReset'})),
})

const mergeProps = (stateProps, dispatchProps) => ({
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
