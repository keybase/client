// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ListComponent from '.'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const hasExtraRow = !meta.resetParticipants.isEmpty() || !!meta.supersededByCausedBy
  return {
    conversationIDKey,
    hasExtraRow,
    messageOrdinals: Constants.getMessageOrdinals(state, conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadMoreMessages: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createLoadMoreMessages({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  hasExtraRow: stateProps.hasExtraRow,
  loadMoreMessages: () => {
    stateProps.conversationIDKey && dispatchProps._loadMoreMessages(stateProps.conversationIDKey)
  },
  messageOrdinals: stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ListComponent)
