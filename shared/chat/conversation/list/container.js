// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List, is, Set} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import * as Selectors from '../../../constants/selectors'

import type {OpenInFileUI} from '../../../constants/kbfs'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {Props} from '.'
import type {TypedState} from '../../../constants/reducer'

const getValidatedState = (state: TypedState) => {
  const inbox = Constants.getSelectedInbox(state)
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (selectedConversationIDKey && Constants.isPendingConversationIDKey(selectedConversationIDKey)) {
    if (Constants.pendingConversationIDKeyToTlfName(selectedConversationIDKey)) {
      // If it's as pending conversation with a tlfname, let's call it valid
      return true
    }
  }
  return (inbox && inbox.state === 'unboxed') || false
}

const supersedesIfNoMoreToLoadSelector = createSelector(
  [Constants.getSelectedConversationStates, Constants.getSupersedes],
  (conversationState, _supersedes) =>
    conversationState && !conversationState.moreToLoad ? _supersedes : null
)

const ownPropsSelector = (_, {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps) => ({
  editLastMessageCounter,
  listScrollDownCounter,
  onFocusInput,
})

const immutableCreateSelector = createSelectorCreator(defaultMemoize, (a, b) => a === b || is(a, b))

const getMessageKeysForSelectedConv = (state: TypedState) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    return List()
  }
  return Constants.getConversationMessages(state, conversationIDKey)
}

const getDeletedIDsForSelectedConv = (state: TypedState) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    return Set()
  }
  return Constants.getDeletedMessageIDs(state, conversationIDKey)
}

const messageKeysSelector = immutableCreateSelector(
  [getMessageKeysForSelectedConv, getDeletedIDsForSelectedConv],
  (ks, deletedIDs) => {
    if (deletedIDs.count()) {
      return ks
        .filterNot(k => {
          const {messageID} = Constants.splitMessageIDKey(k)
          return deletedIDs.has(messageID)
        })
        .toList()
    }
    return ks.toList()
  }
)

const getMessageFromMessageKeyFnSelector = createSelector(
  [state => state.entities.messages],
  (messageMap: Map<Constants.MessageKey, Constants.Message>) => {
    return (messageKey: Constants.MessageKey) => messageMap.get(messageKey)
  }
)

const convStateProps = createSelector(
  [Constants.getSelectedConversation, supersedesIfNoMoreToLoadSelector, getValidatedState],
  (selectedConversation, _supersedes, validated) => ({
    validated,
    _supersedes,
    selectedConversation,
  })
)

const mapStateToProps = createSelector(
  [
    ownPropsSelector,
    Selectors.usernameSelector,
    convStateProps,
    messageKeysSelector,
    getMessageFromMessageKeyFnSelector,
  ],
  (ownProps, username, convStateProps, messageKeys, getMessageFromMessageKey) => ({
    you: username,
    messageKeys,
    getMessageFromMessageKey,
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
        l.unshift(Constants.messageKey(selected, 'supersedes', Constants.selfInventedIDToMessageID(-1)))
      }
      l.unshift(Constants.messageKey(selected, 'header', Constants.selfInventedIDToMessageID(-1)))
    })
  }

  return {
    editLastMessageCounter: stateProps.editLastMessageCounter,
    getMessageFromMessageKey: stateProps.getMessageFromMessageKey,
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
