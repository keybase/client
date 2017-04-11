// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List} from 'immutable'
import {connect} from 'react-redux'
import {downloadFilePath} from '../../../util/file'
import {compose} from 'recompose'

import type {OpenInFileUI} from '../../../constants/kbfs'
// import type {Options} from '../messages'
import type {Props} from '.'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {TypedState} from '../../../constants/reducer'

// TODO reselect

const mapStateToProps = (state: TypedState, {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const you = state.config.username || ''

  let _messages = List()
  let validated = false
  let messageKeys = List()

  if (selectedConversationIDKey && Constants.isPendingConversationIDKey(selectedConversationIDKey)) {
    const tlfName = Constants.pendingConversationIDKeyToTlfName(selectedConversationIDKey)
    if (tlfName) {
      validated = true
    }
  } else if (selectedConversationIDKey && selectedConversationIDKey !== Constants.nothingSelected) {
    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      const inbox = state.chat.get('inbox')
      const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)

      _messages = conversationState.messages
      messageKeys = _messages.map(m => m.key)
      validated = selected && selected.state === 'unboxed'
    }
  }

  if (selectedConversationIDKey) {
    messageKeys = messageKeys.unshift(Constants.messageKey(selectedConversationIDKey, 'header', 0))
  }

  return {
    editLastMessageCounter,
    listScrollDownCounter,
    messageKeys,
    onFocusInput,
    selectedConversation: selectedConversationIDKey,
    validated,
    you,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onLoadAttachment: (selectedConversation, messageID, filename) => { dispatch(Creators.loadAttachment(selectedConversation, messageID, downloadFilePath(filename), false, false)) },
  _onLoadMoreMessages: (conversationIDKey: Constants.ConversationIDKey) => { dispatch(Creators.loadMoreMessages(conversationIDKey, false)) },
  onDeleteMessage: (message: Constants.Message) => { dispatch(Creators.deleteMessage(message)) },
  onEditMessage: (message: Constants.Message, body: string) => { dispatch(Creators.editMessage(message, new HiddenString(body))) },
  onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): Props => {
  return {
    editLastMessageCounter: stateProps.editLastMessageCounter,
    listScrollDownCounter: stateProps.listScrollDownCounter,
    messageKeys: stateProps.messageKeys,
    onDeleteMessage: dispatchProps.onDeleteMessage,
    onEditMessage: dispatchProps.onEditMessage,
    onFocusInput: stateProps.onFocusInput,
    onLoadAttachment: (messageID, filename) => { stateProps.selectedConversation && dispatchProps._onLoadAttachment(stateProps.selectedConversation, messageID, filename) },
    onLoadMoreMessages: () => { stateProps.selectedConversation && dispatchProps._onLoadMoreMessages(stateProps.selectedConversation) },
    onOpenInFileUI: dispatchProps.onOpenInFileUI,
    selectedConversation: stateProps.selectedConversation,
    validated: stateProps.validated,
    you: stateProps.you,
  }
}

// function decorateSupersedes (supersedes, moreToLoad, messages): List<Constants.Message> {
  // if (supersedes && !moreToLoad) {
    // const {conversationIDKey, finalizeInfo: {resetUser}} = supersedes
    // const supersedesMessage: Constants.SupersedesMessage = {
      // key: `supersedes-${conversationIDKey}-${resetUser}`,
      // supersedes: conversationIDKey,
      // timestamp: Date.now(),
      // type: 'Supersedes',
      // username: resetUser,
    // }
    // return messages.unshift(supersedesMessage)
  // }

  // return messages
// }

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
)(ListComponent)
