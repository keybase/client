// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import {downloadFilePath} from '../../util/file'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {deleteMessage, editMessage, loadMoreMessages, newChat, openFolder, postMessage, selectAttachment, loadAttachment} from '../../actions/chat'
import {nothingSelected} from '../../constants/chat'
import {onUserClick} from '../../actions/profile'
import {getProfile} from '../../actions/tracker'
import {navigateAppend} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {ConversationIDKey, Message, AttachmentMessage} from '../../constants/chat'
import type {Props} from '.'

type OwnProps = {}
type State = {
  sidePanelOpen: boolean,
}

class ConversationContainer extends Component<void, Props, State> {
  state: State

  constructor (props: Props) {
    super(props)
    this.state = {sidePanelOpen: false}
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

  render () {
    if (!this.props.selectedConversation) {
      return <Box style={{flex: 1}} />
    }

    return <Conversation
      {...this.props}
      sidePanelOpen={this.state.sidePanelOpen}
      onToggleSidePanel={this._onToggleSidePanel}
    />
  }
}

export default connect(
  (state: TypedState, {routePath}) => {
    const selectedConversation = routePath.last()

    const you = state.config.username || ''
    const followingMap = state.config.following

    if (selectedConversation !== nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)
        const participants = selected && selected.participants || List()
        const metaDataMap = state.chat.get('metaData')

        return {
          participants,
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
          isLoading: conversationState.isLoading,
          validated: selected && selected.validated,
          firstNewMessageID: conversationState.firstNewMessageID,
          selectedConversation,
          emojiPickerOpen: false,
          metaDataMap,
          you,
          followingMap,
          bannerMessage: null,
        }
      }
    }

    return {
      participants: List(),
      messages: List(),
      moreToLoad: false,
      isLoading: false,
      validated: false,
      selectedConversation,
      metaDataMap: Map(),
      you,
      followingMap,
      bannerMessage: null,
    }
  },
  (dispatch: Dispatch) => ({
    onEditMessage: (message: Message) => { dispatch(editMessage(message)) },
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
    onShowTracker: (username: string) => dispatch(getProfile(username, true)),
    onOpenFolder: () => dispatch(openFolder()),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, filename, title) => dispatch(selectAttachment(selectedConversation, filename, title)),
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, downloadFilePath(filename))),
    onOpenInPopup: (message: AttachmentMessage) => dispatch(navigateAppend([{selected: 'attachment', props: {message}}])),
    onOpenInFileUI: (path: string) => dispatch(({type: 'fs:openInFileUI', payload: {path}}: OpenInFileUI)),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const brokenUsers = stateProps.participants.filter(user => stateProps.metaDataMap.get(user, Map()).get('brokenTracker', false)).toArray()
    const bannerMessage = brokenUsers.length
      ? {
        type: 'BrokenTracker',
        users: brokenUsers,
        onClick: (user: string) => dispatchProps.onShowTracker(user),
      }
      : null

    return {
      ...stateProps,
      ...dispatchProps,
      ...ownProps,
      bannerMessage,
      onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
      onAttach: (filename: string, title: string) => dispatchProps.onAttach(stateProps.selectedConversation, filename, title),
      onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversation),
      onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversation, messageID, filename),
      onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => !p.you).map(p => p.username).toArray()),
    }
  },
)(ConversationContainer)
