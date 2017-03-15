// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {deleteMessage, editMessage, loadMoreMessages, muteConversation, newChat, openFolder, postMessage, retryMessage, selectAttachment, startConversation, loadAttachment, retryAttachment, showEditor} from '../../actions/chat'
import * as ChatConstants from '../../constants/chat'
import {CommonConversationStatus} from '../../constants/types/flow-types-chat'
import {downloadFilePath} from '../../util/file'
import {getProfile} from '../../actions/tracker'
import {navigateAppend} from '../../actions/route-tree'
import {onUserClick} from '../../actions/profile'
import {openDialog as openRekeyDialog} from '../../actions/unlock-folders'
import {pick} from 'lodash'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {ConversationIDKey, Message, AttachmentInput, AttachmentMessage, OpenAttachmentPopup, OutboxIDKey, ServerMessage} from '../../constants/chat'
import type {Props} from '.'

const {nothingSelected, getBrokenUsers, pendingConversationIDKeyToTlfName, isPendingConversationIDKey} = ChatConstants

type OwnProps = {}
type State = {
  listScrollDownCounter: number, // count goes up when this mutates, causing the list to scroll down
  sidePanelOpen: boolean,
}

class ConversationContainer extends Component<void, Props, State> {
  state: State

  constructor (props: Props) {
    super(props)
    this.state = {
      listScrollDownCounter: 0,
      sidePanelOpen: false,
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation) {
      this.setState({
        sidePanelOpen: false,
      })
    }
  }

  _onToggleSidePanel = () => {
    this.setState({sidePanelOpen: !this.state.sidePanelOpen})
  }

  _onTriggerScrollDown = () => {
    this.setState({listScrollDownCounter: this.state.listScrollDownCounter + 1})
  }

  render () {
    if (!this.props.selectedConversation) {
      return <Box style={{flex: 1}} />
    }

    return <Conversation
      {...this.props}
      sidePanelOpen={this.state.sidePanelOpen}
      onToggleSidePanel={this._onToggleSidePanel}
      onPostMessage={(...args) => {
        this._onTriggerScrollDown()
        this.props.onPostMessage(...args)
      }}
      listScrollDownState={this.state.listScrollDownCounter}
    />
  }
}

export default connect(
  (state: TypedState, {routePath, routeState}) => {
    const selectedConversation = routePath.last()

    const you = state.config.username || ''
    const followingMap = state.config.following
    const metaDataMap = state.chat.get('metaData')

    if (isPendingConversationIDKey(selectedConversation)) {
      const tlfName = pendingConversationIDKeyToTlfName(selectedConversation)
      if (tlfName) {
        const participants = List(tlfName.split(','))

        return {
          bannerMessage: null,
          emojiPickerOpen: false,
          followingMap: pick(followingMap, participants.toArray()),
          inputText: routeState.inputText && routeState.inputText.stringValue(),
          isLoading: false,
          messages: List(),
          metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
          moreToLoad: false,
          muted: false,
          participants,
          rekeyInfo: null,
          selectedConversation,
          validated: true,
          you,
        }
      }
    }

    if (selectedConversation !== nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)
        const muted = selected && selected.get('info') && selected.get('info').status === CommonConversationStatus.muted
        const participants = selected && selected.participants || List()
        const rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversation)

        const supersedes = ChatConstants.convSupersedesInfo(selectedConversation, state.chat)
        const supersededBy = ChatConstants.convSupersededByInfo(selectedConversation, state.chat)
        const finalizeInfo = state.chat.get('finalizedState').get(selectedConversation)

        return {
          bannerMessage: null,
          emojiPickerOpen: false,
          firstNewMessageID: conversationState.firstNewMessageID,
          followingMap: pick(followingMap, participants.toArray()),
          inputText: routeState.inputText && routeState.inputText.stringValue(),
          isLoading: conversationState.isLoading,
          messages: conversationState.messages,
          metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
          moreToLoad: conversationState.moreToLoad,
          muted,
          participants,
          rekeyInfo,
          selectedConversation,
          validated: selected && selected.validated,
          you,
          supersedes,
          supersededBy,
          finalizeInfo,
          editingMessage: state.chat.get('editingMessage'),
        }
      }
    }

    return {
      bannerMessage: null,
      followingMap,
      isLoading: false,
      messages: List(),
      metaDataMap: Map(),
      moreToLoad: false,
      participants: List(),
      rekeyInfo: null,
      selectedConversation,
      validated: false,
      you,
      supersedes: null,
      supersededBy: null,
    }
  },
  (dispatch: Dispatch, {setRouteState, navigateUp}) => ({
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, inputs: Array<AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
    onBack: () => dispatch(navigateUp()),
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onEditMessage: (message: Message, body: string) => { dispatch(editMessage(message, new HiddenString(body))) },
    onShowBlockConversationDialog: (selectedConversation, participants) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, participants}, selected: 'showBlockConversationDialog'}])) },
    onShowEditor: (message: Message) => { dispatch(showEditor(message)) },
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, false, downloadFilePath(filename))),
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
    onMessageAction: (message: ServerMessage) => dispatch(navigateAppend([{
      props: {
        message,
      },
      selected: 'messageAction',
    }])),
    onMuteConversation: (conversationIDKey: ConversationIDKey, muted: boolean) => { dispatch(muteConversation(conversationIDKey, muted)) },
    onOpenFolder: () => dispatch(openFolder()),
    onOpenConversation: (conversationIDKey: ConversationIDKey) => {
      dispatch(({
        payload: {conversationIDKey},
        type: 'chat:openConversation',
      }: ChatConstants.OpenConversation))
    },
    onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
    onOpenInPopup: (message: AttachmentMessage) => dispatch(({type: 'chat:openAttachmentPopup', payload: {message}}: OpenAttachmentPopup)),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onRetryAttachment: (message: AttachmentMessage) => dispatch(retryAttachment(message)),
    onRetryMessage: (conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey) => dispatch(retryMessage(conversationIDKey, outboxID)),
    onSelectAttachment: (conversationIDKey: ConversationIDKey, input: AttachmentInput) => dispatch(selectAttachment(input)),
    startConversation: (users: Array<string>) => dispatch(startConversation(users, true)),
    onStoreInputText: (inputText: string) => setRouteState({inputText: new HiddenString(inputText)}),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
    onShowTracker: (username: string) => dispatch(getProfile(username, true, true)),
    onRekey: () => dispatch(openRekeyDialog()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    let bannerMessage

    const brokenUsers = getBrokenUsers(stateProps.participants.toArray(), stateProps.you, stateProps.metaDataMap)
    if (brokenUsers.length) {
      bannerMessage = {
        onClick: (user: string) => dispatchProps.onShowTracker(user),
        type: 'BrokenTracker',
        users: brokenUsers,
      }
    }

    if (!bannerMessage) {
      const sbsUsers = stateProps.participants.filter(p => p.includes('@')).toArray()
      if (sbsUsers.length) {
        bannerMessage = {
          type: 'Invite',
          users: sbsUsers,
        }
      }
    }

    return {
      ...stateProps,
      ...dispatchProps,
      ...ownProps,
      bannerMessage,
      onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => p !== stateProps.you).toArray()),
      onAttach: (inputs: Array<AttachmentInput>) => dispatchProps.onAttach(stateProps.selectedConversation, inputs),
      onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversation, messageID, filename),
      onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversation),
      onMuteConversation: (muted: boolean) => dispatchProps.onMuteConversation(stateProps.selectedConversation, muted),
      onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
      onRetryMessage: (outboxID: OutboxIDKey) => dispatchProps.onRetryMessage(stateProps.selectedConversation, outboxID),
      onSelectAttachment: (input) => dispatchProps.onSelectAttachment(stateProps.selectedConversation, input),
      onShowBlockConversationDialog: () => dispatchProps.onShowBlockConversationDialog(stateProps.selectedConversation, stateProps.participants.toArray().join(',')),
      restartConversation: () => dispatchProps.startConversation(stateProps.participants.toArray()),
    }
  },
)(ConversationContainer)
