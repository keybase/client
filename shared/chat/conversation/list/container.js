// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import ListComponent from '.'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {downloadFilePath} from '../../../util/file'
import {navigateAppend} from '../../../actions/route-tree'
import {pick} from 'lodash'
import {compose} from 'recompose'
import {getPath} from '../../../route-tree'
import {chatTab} from '../../../constants/tabs'

import type {OpenInFileUI} from '../../../constants/kbfs'
import type {Options} from '../messages'
import type {Props, OptionsFn} from '.'
import type {OwnProps, StateProps, DispatchProps} from './container'
import type {TypedState} from '../../../constants/reducer'

const mapStateToProps = (state: TypedState, {editLastMessageCounter, listScrollDownCounter, onFocusInput}: OwnProps): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const routePath = getPath(state.routeTree.routeState, [chatTab])
  const you = state.config.username || ''
  const origFollowingMap = state.config.following
  const origMetaDataMap = state.chat.get('metaData')

  let firstNewMessageID = null
  let followingMap = Map()
  let messages = List()
  let metaDataMap = Map()
  let moreToLoad = false
  let participants = List()
  let editingMessage = null
  let supersedes = null
  let supersededBy = null
  let validated = false

  if (selectedConversationIDKey && Constants.isPendingConversationIDKey(selectedConversationIDKey)) {
    const tlfName = Constants.pendingConversationIDKeyToTlfName(selectedConversationIDKey)
    if (tlfName) {
      participants = List(tlfName.split(','))
      followingMap = pick(origFollowingMap, participants.toArray())
      metaDataMap = origMetaDataMap.filter((k, v) => participants.contains(v))
      validated = true
    }
  } else if (selectedConversationIDKey && selectedConversationIDKey !== Constants.nothingSelected) {
    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      const inbox = state.chat.get('inbox')
      const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)

      participants = selected && selected.participants || List()
      firstNewMessageID = conversationState.firstNewMessageID
      followingMap = pick(origFollowingMap, participants.toArray())
      messages = conversationState.messages
      metaDataMap = origMetaDataMap.filter((k, v) => participants.contains(v))
      moreToLoad = conversationState.moreToLoad
      editingMessage = state.chat.get('editingMessage')
      supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
      supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)
      validated = selected && selected.state === 'unboxed'
    }
  }

  return {
    editLastMessageCounter,
    editingMessage,
    firstNewMessageID,
    followingMap,
    listScrollDownCounter,
    messages,
    metaDataMap,
    moreToLoad,
    onFocusInput,
    participants,
    routePath,
    selectedConversation: selectedConversationIDKey,
    supersededBy,
    supersedes,
    validated,
    you,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onLoadAttachment: (selectedConversation, messageID, filename) => { dispatch(Creators.loadAttachment(selectedConversation, messageID, downloadFilePath(filename), false, false)) },
  _onLoadMoreMessages: (conversationIDKey: Constants.ConversationIDKey) => { dispatch(Creators.loadMoreMessages(conversationIDKey, false)) },
  _onOpenInPopup: (message: Constants.AttachmentMessage, routePath: List<string>) => dispatch(Creators.openAttachmentPopup(message, routePath)),
  _onRetryMessage: (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) => dispatch(Creators.retryMessage(conversationIDKey, outboxID)),
  onDeleteMessage: (message: Constants.Message) => { dispatch(Creators.deleteMessage(message)) },
  onEditMessage: (message: Constants.Message, body: string) => { dispatch(Creators.editMessage(message, new HiddenString(body))) },
  onMessageAction: (message: Constants.ServerMessage) => dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) => dispatch(Creators.openConversation(conversationIDKey)),
  onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
  onRetryAttachment: (message: Constants.AttachmentMessage) => dispatch(Creators.retryAttachment(message)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): Props => {
  const props = {
    ...stateProps,
    ...dispatchProps,
    headerMessages: List([
      {key: `chatSecuredHeader-${stateProps.moreToLoad.toString()}`, type: 'ChatSecuredHeader'},
      {key: `loadingMore-${stateProps.moreToLoad.toString()}`, type: 'LoadingMore'},
    ]),
    onLoadAttachment: (messageID, filename) => { stateProps.selectedConversation && dispatchProps._onLoadAttachment(stateProps.selectedConversation, messageID, filename) },
    onLoadMoreMessages: () => { stateProps.selectedConversation && dispatchProps._onLoadMoreMessages(stateProps.selectedConversation) },
    onOpenInPopup: (message: Constants.AttachmentMessage) => { dispatchProps._onOpenInPopup(message, stateProps.routePath) },
    onRetryMessage: (outboxID: Constants.OutboxIDKey) => { stateProps.selectedConversation && dispatchProps._onRetryMessage(stateProps.selectedConversation, outboxID) },
  }

  return {
    ...props,
    messages: decorateSupersedes(props.supersedes, props.moreToLoad, props.messages),
    optionsFn: propsToMessageOptionsFn(props),
  }
}

function decorateSupersedes (supersedes, moreToLoad, messages): List<Constants.Message> {
  if (supersedes && !moreToLoad) {
    const {conversationIDKey, finalizeInfo: {resetUser}} = supersedes
    const supersedesMessage: Constants.SupersedesMessage = {
      key: `supersedes-${conversationIDKey}-${resetUser}`,
      supersedes: conversationIDKey,
      timestamp: Date.now(),
      type: 'Supersedes',
      username: resetUser,
    }
    return messages.unshift(supersedesMessage)
  }

  return messages
}

// TODO remove this. Not needed w/ connected messages
// $FlowIssue wants props with optionsFn inside of it, which this thing itself is building. This'll all go away soon
function propsToMessageOptionsFn (props: Props): OptionsFn {
  return function (message, prevMessage, isFirstMessage, isSelected, isScrolling, key, style, onAction, onShowEditor, isEditing = false): Options {
    const skipMsgHeader = (message.author != null && prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)
    const isFirstNewMessage = message.messageID != null && props.firstNewMessageID ? props.firstNewMessageID === message.messageID : false
    return {
      ...props,
      includeHeader: isFirstMessage || !skipMsgHeader,
      isEditing,
      isFirstNewMessage,
      isScrolling,
      isSelected,
      key,
      message,
      onAction,
      onRetry: props.onRetryMessage,
      onRetryAttachment: (message) => { message.type === 'Attachment' && props.onRetryAttachment(message) },
      onShowEditor,
      style,
    }
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
)(ListComponent)
