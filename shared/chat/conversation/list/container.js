// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'
import {createSelector} from 'reselect'
import * as Selectors from '../../../constants/selectors'

import type {OpenInFileUI} from '../../../constants/kbfs'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {Props} from '.'

// TODO change this. This is a temporary store for the messages so we can have a function to map from
// messageKey to Message to support the 'edit last message' functionality. We should change how this works
let _messages: List<Constants.Message> = List()
const _getMessageFromMessageKey = (messageKey: Constants.MessageKey): ?Constants.Message =>
  _messages.find(m => m.key === messageKey)

const getPropsFromConversationState = createSelector(
  [Constants.getSelectedConversationStates, Constants.getSelectedInbox, Constants.getSupersedes],
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

const ownPropsSelector = (_, {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps) => ({
  editLastMessageCounter,
  listScrollDownCounter,
  onFocusInput,
})

const convStateProps = createSelector(
  [Constants.getSelectedConversation, getPropsFromConversationState],
  (selectedConversationIDKey, convStateProps) => {
    let validated = false
    let messageKeys = List()
    let supersedes

    if (selectedConversationIDKey && Constants.isPendingConversationIDKey(selectedConversationIDKey)) {
      const tlfName = Constants.pendingConversationIDKeyToTlfName(selectedConversationIDKey)
      if (tlfName) {
        validated = true
      }
    } else if (selectedConversationIDKey && selectedConversationIDKey !== Constants.nothingSelected) {
      supersedes = convStateProps.supersedes
      if (convStateProps.messageKeys.equals(_lastMessageKeys)) {
        if (messageKeys !== _lastMessageKeys) {
          console.log('Message keys are not the same!!!')
        }
        // messageKeys = _lastMessageKeys
      } else {
        _lastMessageKeys = messageKeys
      }
      messageKeys = convStateProps.messageKeys
      validated = convStateProps.validated
    }

    return {
      validated,
      messageKeys,
      _supersedes: supersedes,
      selectedConversation: selectedConversationIDKey,
    }
  }
)

const mapStateToProps = createSelector(
  [ownPropsSelector, Selectors.usernameSelector, convStateProps],
  (ownProps, username, convStateProps) => ({
    you: username,
    ...ownProps,
    ...convStateProps,
  })
)

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onDownloadAttachment: messageKey => {
    dispatch(Creators.saveAttachment(messageKey))
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
  onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): Props => {
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
    onDownloadAttachment: messageKey => {
      stateProps.selectedConversation && dispatchProps._onDownloadAttachment(messageKey)
    },
    onLoadMoreMessages: () => {
      stateProps.selectedConversation && dispatchProps._onLoadMoreMessages(stateProps.selectedConversation)
    },
    onMessageAction: dispatchProps.onMessageAction,
    onOpenInFileUI: dispatchProps.onOpenInFileUI,
    selectedConversation: stateProps.selectedConversation,
    validated: stateProps.validated,
    you: stateProps.you,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(ListComponent)
