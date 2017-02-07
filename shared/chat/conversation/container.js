// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {deleteMessage, editMessage, loadMoreMessages, muteConversation, newChat, openFolder, postMessage, retryMessage, loadAttachment, retryAttachment} from '../../actions/chat'
import {downloadFilePath} from '../../util/file'
import {getProfile} from '../../actions/tracker'
import {navigateAppend} from '../../actions/route-tree'
import {nothingSelected, getBrokenUsers} from '../../constants/chat'
import {onUserClick} from '../../actions/profile'
import {openDialog as openRekeyDialog} from '../../actions/unlock-folders'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {ConversationIDKey, Message, AttachmentInput, AttachmentMessage, OpenAttachmentPopup, OutboxIDKey} from '../../constants/chat'
import type {Props} from '.'

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

    if (selectedConversation !== nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)
        const muted = selected && selected.get('muted')
        const participants = selected && selected.participants || List()
        const metaDataMap = state.chat.get('metaData')
        const rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversation)

        return {
          bannerMessage: null,
          emojiPickerOpen: false,
          firstNewMessageID: conversationState.firstNewMessageID,
          followingMap,
          inputText: routeState.inputText,
          isLoading: conversationState.isLoading,
          messages: conversationState.messages,
          metaDataMap,
          moreToLoad: conversationState.moreToLoad,
          muted,
          participants,
          rekeyInfo,
          selectedConversation,
          validated: selected && selected.validated,
          you,
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
    }
  },
  (dispatch: Dispatch, {setRouteState}) => ({
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, inputs: Array<AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onEditMessage: (message: Message, body: string) => { dispatch(editMessage(message, new HiddenString(body))) },
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, false, downloadFilePath(filename))),
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
    onMuteConversation: (conversationIDKey: ConversationIDKey, muted: boolean) => { dispatch(muteConversation(conversationIDKey, muted)) },
    onOpenFolder: () => dispatch(openFolder()),
    onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
    onOpenInPopup: (message: AttachmentMessage) => dispatch(({type: 'chat:openAttachmentPopup', payload: {message}}: OpenAttachmentPopup)),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onRetryAttachment: (message: AttachmentMessage) => dispatch(retryAttachment(message)),
    onRetryMessage: (conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey) => dispatch(retryMessage(conversationIDKey, outboxID)),
    onStoreInputText: (inputText: string) => setRouteState({inputText}),
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
    }
  },
)(ConversationContainer)
