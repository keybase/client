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
  const editInfo = Constants.getEditInfo(state, conversationIDKey)
  const quoteInfo = Constants.getQuoteInfo(state, conversationIDKey)

  const _you = state.config.username || ''

  return {
    _editText: editInfo ? editInfo.text : '',
    _editOrdinal: editInfo ? editInfo.ordinal : null,
    _quoteCounter: quoteInfo ? quoteInfo.counter : 0,
    _quoteText: quoteInfo ? quoteInfo.text : '',
    _you,
    conversationIDKey,
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
  _onEditMessage: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey,
        ordinal,
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
  isEditing: !!stateProps._editOrdinal,
  focusInputCounter: ownProps.focusInputCounter,
  clearInboxFilter: dispatchProps.clearInboxFilter,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onSubmit: (text: string) => {
    if (stateProps._editOrdinal) {
      dispatchProps._onEditMessage(stateProps.conversationIDKey, stateProps._editOrdinal, text)
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text)
    }
    ownProps.onScrollDown()
  },
  typing: stateProps.typing,

  _editText: stateProps._editText,
  _quoteCounter: stateProps._quoteCounter,
  _quoteText: stateProps._quoteText,

  getUnsentText: () => getUnsentText(stateProps.conversationIDKey),
  setUnsentText: (text: string) => setUnsentText(stateProps.conversationIDKey, text),
  sendTyping: (typing: boolean) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, typing)
  },
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Input)
