// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import HiddenString from '../../../../util/hidden-string'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'
import {isEqual} from 'lodash-es'
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
  const editingOrdinal = Constants.getEditingOrdinal(state, conversationIDKey)
  const _editingMessage: ?Types.Message = editingOrdinal
    ? Constants.getMessageMap(state, conversationIDKey).get(editingOrdinal)
    : null
  const quote = Constants.getQuotingOrdinalAndSource(
    state,
    state.chat2.pendingSelected ? Constants.pendingConversationIDKey : conversationIDKey
  )
  let _quotingMessage: ?Types.Message = null
  if (quote) {
    const {ordinal, sourceConversationIDKey} = quote
    _quotingMessage = ordinal ? Constants.getMessageMap(state, sourceConversationIDKey).get(ordinal) : null
  }

  // Sanity check -- is this quoted-pending message for the right person?
  if (
    state.chat2.pendingSelected &&
    _quotingMessage &&
    !isEqual([_quotingMessage.author], state.chat2.pendingConversationUsers.toArray())
  ) {
    console.warn(
      'Should never happen:',
      state.chat2.pendingConversationUsers.toArray(),
      'vs',
      _quotingMessage.author
    )
    _quotingMessage = null
  }

  const _you = state.config.username || ''
  const pendingWaiting = state.chat2.pendingSelected && state.chat2.pendingStatus === 'waiting'

  const injectedInputMessage: ?Types.Message = _editingMessage || _quotingMessage || null
  const injectedInput: string =
    injectedInputMessage && injectedInputMessage.type === 'text'
      ? injectedInputMessage.text.stringValue()
      : ''

  return {
    _editingMessage,
    _meta: Constants.getMeta(state, conversationIDKey),
    _quotingMessage,
    _you,
    conversationIDKey,
    injectedInput,
    pendingWaiting,
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
  _onCancelQuoting: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(
      Chat2Gen.createMessageSetQuoting({
        ordinal: null,
        sourceConversationIDKey: conversationIDKey,
        targetConversationIDKey: conversationIDKey,
      })
    ),
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
  channelName: stateProps._meta.channelname,
  isEditing: !!stateProps._editingMessage,
  focusInputCounter: ownProps.focusInputCounter,
  clearInboxFilter: dispatchProps.clearInboxFilter,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onCancelEditing: () => {
    dispatchProps._onCancelQuoting(stateProps.conversationIDKey)
    dispatchProps._onCancelEditing(stateProps.conversationIDKey)
  },
  onCancelQuoting: () => dispatchProps._onCancelQuoting(stateProps.conversationIDKey),
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
  pendingWaiting: stateProps.pendingWaiting,
  typing: stateProps.typing,

  _quotingMessage: stateProps._quotingMessage,
  _editingMessage: stateProps._editingMessage,
  injectedInput: stateProps.injectedInput,

  getUnsentText: () => getUnsentText(stateProps.conversationIDKey),
  setUnsentText: (text: string) => setUnsentText(stateProps.conversationIDKey, text),
  sendTyping: (typing: boolean) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, typing)
  },
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Input)
