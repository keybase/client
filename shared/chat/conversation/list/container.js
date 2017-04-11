// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {downloadFilePath} from '../../../util/file'

import type {OpenInFileUI} from '../../../constants/kbfs'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {Props} from '.'
import type {TypedState} from '../../../constants/reducer'

// TODO reselect

const mapStateToProps = (state: TypedState, {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const you = state.config.username || ''

  let validated = false
  let messageKeys = List()
  let supersedes

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

      if (!conversationState.moreToLoad) {
        supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
      }

      messageKeys = conversationState.messages.map(m => m.key)
      validated = selected && selected.state === 'unboxed'
    }
  }

  if (selectedConversationIDKey) {
    messageKeys = messageKeys.withMutations(l => {
      if (supersedes) {
        l.unshift(Constants.messageKey(selectedConversationIDKey, 'supersedes', 0))
      }
      l.unshift(Constants.messageKey(selectedConversationIDKey, 'header', 0))
    })
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
)(ListComponent)
