// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {navigateAppend} from '../../../actions/route-tree'

import type {OpenInFileUI} from '../../../constants/kbfs'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {Props} from '.'
import type {TypedState} from '../../../constants/reducer'

// TODO change this. This is a temporary store for the messages so we can have a function to map from
// messageKey to Message to support the 'edit last message' functionality. We should change how this works
let _messages: List<Constants.Message> = List()
const _getMessageFromMessageKey = (
  messageKey: Constants.MessageKey
): ?Constants.Message => _messages.find(m => m.key === messageKey)

const getPropsFromConversationState = createSelector(
  [
    Constants.getSelectedConversationStates,
    Constants.getSelectedInbox,
    Constants.getSupersedes,
  ],
  (conversationState, inbox, _supersedes) => {
    let supersedes = null
    let messageKeys = List()
    let validated = false
    if (conversationState) {
      if (!conversationState.moreToLoad) {
        supersedes = _supersedes
      }

      messageKeys = conversationState.messages.map(m => m.key)
      _messages = conversationState.messages
      validated = inbox && inbox.state === 'unboxed'
    }
    return {
      messageKeys,
      supersedes,
      validated,
    }
  }
)

// This is a temporary solution until I can cleanup the reducer in a different PR
// messageKeys is being derived so it can change even when nothing else is causing re-renders
// As a short term 'cheat' i'm keeping the last copy and returning that if its equivalent. TODO take this out later
let _lastMessageKeys = List()

const mapStateToProps = (
  state: TypedState,
  {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps
): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const you = state.config.username || ''

  let validated = false
  let messageKeys = List()
  let supersedes

  if (
    selectedConversationIDKey &&
    Constants.isPendingConversationIDKey(selectedConversationIDKey)
  ) {
    const tlfName = Constants.pendingConversationIDKeyToTlfName(
      selectedConversationIDKey
    )
    if (tlfName) {
      validated = true
    }
  } else if (
    selectedConversationIDKey &&
    selectedConversationIDKey !== Constants.nothingSelected
  ) {
    const temp = getPropsFromConversationState(state)
    supersedes = temp.supersedes
    if (temp.messageKeys.equals(_lastMessageKeys)) {
      messageKeys = _lastMessageKeys
    } else {
      messageKeys = temp.messageKeys
      _lastMessageKeys = messageKeys
    }
    validated = temp.validated
  }

  return {
    _supersedes: supersedes,
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
  _onDownloadAttachment: (selectedConversation, messageID) => {
    dispatch(Creators.saveAttachment(selectedConversation, messageID))
  },
  _onLoadMoreMessages: (conversationIDKey: Constants.ConversationIDKey) => {
    dispatch(Creators.loadMoreMessages(conversationIDKey, false))
  },
  onDeleteMessage: (message: Constants.Message) => {
    dispatch(Creators.deleteMessage(message))
  },
  onEditMessage: (message: Constants.Message, body: string) => {
    dispatch(Creators.editMessage(message, new HiddenString(body)))
  },
  onMessageAction: (message: Constants.Message) => {
    dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}]))
  },
  onOpenInFileUI: (path: string) =>
    dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
})

const mergeProps = (
  stateProps: StateProps,
  dispatchProps: DispatchProps
): Props => {
  let messageKeysWithHeaders = stateProps.messageKeys
  const selected = stateProps.selectedConversation
  if (selected) {
    messageKeysWithHeaders = messageKeysWithHeaders.withMutations(l => {
      if (stateProps._supersedes) {
        l.unshift(Constants.messageKey(selected, 'supersedes', 0))
      }
      l.unshift(Constants.messageKey(selected, 'header', 0))
    })
  }

  return {
    editLastMessageCounter: stateProps.editLastMessageCounter,
    getMessageFromMessageKey: _getMessageFromMessageKey,
    listScrollDownCounter: stateProps.listScrollDownCounter,
    messageKeys: messageKeysWithHeaders,
    onDeleteMessage: dispatchProps.onDeleteMessage,
    onEditMessage: dispatchProps.onEditMessage,
    onFocusInput: stateProps.onFocusInput,
    onDownloadAttachment: messageID => {
      stateProps.selectedConversation &&
        dispatchProps._onDownloadAttachment(
          stateProps.selectedConversation,
          messageID
        )
    },
    onLoadMoreMessages: () => {
      stateProps.selectedConversation &&
        dispatchProps._onLoadMoreMessages(stateProps.selectedConversation)
    },
    onMessageAction: dispatchProps.onMessageAction,
    onOpenInFileUI: dispatchProps.onOpenInFileUI,
    selectedConversation: stateProps.selectedConversation,
    validated: stateProps.validated,
    you: stateProps.you,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(ListComponent)
