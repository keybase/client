// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import HiddenString from '../../../../util/hidden-string'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'
import Input, {type Props} from '.'

type OwnProps = {
  focusInputCounter: number,
  onScrollDown: () => void,
}

// We used to store this in the route state but that's so complicated. We just want a map of id => text if we haven't sent
const unsentText: {[Types.ConversationIDKey]: string} = {}

const getUnsentText = (conversationIDKey: Types.ConversationIDKey): string => {
  return unsentText[conversationIDKey] || ''
}

const setUnsentText = (conversationIDKey: Types.ConversationIDKey, text: string) => {
  unsentText[conversationIDKey] = text
}

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const editingState = Constants.getEditingState(state, conversationIDKey)
  const _editingMessage: ?Types.Message = editingState
    ? Constants.getMessageMap(state, conversationIDKey).get(editingState.ordinal)
    : null
  const quotingState = Constants.getQuotingState(
    state, conversationIDKey)
  let _quotingMessage: ?Types.Message = quotingState
    ? Constants.getMessageMap(state, quotingState.sourceConversationIDKey).get(quotingState.ordinal)
    : null

  const _you = state.config.username || ''
  const injectedInputMessage: ?Types.Message = _editingMessage || _quotingMessage || null
  const injectedInput: string =
    injectedInputMessage && injectedInputMessage.type === 'text'
      ? injectedInputMessage.text.stringValue()
      : ''

  return {
    _editingCounter: editingState ? editingState.counter : 0,
    _editingMessage,
    _quotingCounter: quotingState ? quotingState.counter : 0,
    _quotingMessage,
    _you,
    channelName: meta.channelname,
    conversationIDKey,
    injectedInput,
    typing: Constants.getTyping(state, conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) =>
    dispatch(
      RouteTree.navigateAppend([{props: {conversationIDKey, paths}, selected: 'attachmentGetTitles'}])
    ),
  _onCancelEditing: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null})),
  _onEditLastMessage: (conversationIDKey: Types.ConversationIDKey, you: string) =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: you,
        ordinal: null,
      })
    ),
  _onEditMessage: (message: Types.Message, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
        text: new HiddenString(body),
      })
    ),
  _onPostMessage: (conversationIDKey: Types.ConversationIDKey, text: string) =>
    dispatch(Chat2Gen.createMessageSend({conversationIDKey, text: new HiddenString(text)})),
  _sendTyping: (conversationIDKey: Types.ConversationIDKey, typing: boolean) =>
    // only valid conversations
    conversationIDKey && dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing})),
  clearInboxFilter: () => dispatch(Chat2Gen.createSetInboxFilter({filter: ''})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  conversationIDKey: stateProps.conversationIDKey,
  channelName: stateProps.channelName,
  isEditing: !!stateProps._editingMessage,
  focusInputCounter: ownProps.focusInputCounter,
  clearInboxFilter: dispatchProps.clearInboxFilter,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onSubmit: (text: string) => {
    const em = stateProps._editingMessage
    if (em) {
      if (em.type === 'text' && em.text.stringValue() === text) {
        dispatchProps._onCancelEditing(stateProps.conversationIDKey)
      } else {
        dispatchProps._onEditMessage(em, text)
      }
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text)
    }
    ownProps.onScrollDown()
  },
  typing: stateProps.typing,

  _editingCounter: stateProps._editingCounter,
  _editingMessage: stateProps._editingMessage,
  _quotingCounter: stateProps._quotingCounter,
  _quotingMessage: stateProps._quotingMessage,
  injectedInput: stateProps.injectedInput,

  getUnsentText: () => getUnsentText(stateProps.conversationIDKey),
  setUnsentText: (text: string) => setUnsentText(stateProps.conversationIDKey, text),
  sendTyping: (typing: boolean) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, typing)
  },
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Input)
