// @flow
import UserInput from '../../../search/user-input/container'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {
  connect,
  compose,
  withStateHandlers,
  lifecycle,
  withProps,
  type TypedState,
  type Dispatch,
} from '../../../util/container'

const mapStateToProps = (state: TypedState) => {
  const meta = Constants.getMeta(state, Constants.pendingConversationIDKey)
  return {
    pendingConversationUsers: meta.participants,
    resolvedConversationIDKey: meta.conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClearSearch: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
  _onExitSearch: (conversationIDKey: Types.ConversationIDKey) => {
    if (conversationIDKey !== Constants.pendingConversationIDKey) {
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'startFoundExisting'}))
    } else {
      Chat2Gen.createSetPendingMode({pendingMode: 'none'})
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onExitSearch: () => dispatchProps._onExitSearch(stateProps.resolvedConversationIDKey),
  }
}
export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {focusInputCounter: 0},
    {incrementFocus: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1})}
  ),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.pendingConversationUsers !== prevProps.pendingConversationUsers) {
        this.props.incrementFocus()
      }
    },
  }),
  withProps({
    autoFocus: true,
    searchKey: 'chatSearch',
    placeholder: 'Search someone',
  })
)(UserInput)
