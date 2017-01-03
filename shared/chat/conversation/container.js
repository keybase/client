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

    if (selectedConversation !== nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)

        return {
          participants: selected && selected.participants || List(),
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
          isLoading: conversationState.isLoading,
          validated: selected && selected.validated,
          firstNewMessageID: conversationState.firstNewMessageID,
          selectedConversation,
          emojiPickerOpen: false,
          metaData: state.chat.get('metaData'),
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
      metaData: Map(),
      bannerMessage: null,
    }
  },
  (dispatch: Dispatch) => ({
    onEditMessage: (message: Message) => { dispatch(editMessage(message)) },
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
    onOpenFolder: () => dispatch(openFolder()),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, filename, title) => dispatch(selectAttachment(selectedConversation, filename, title)),
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, downloadFilePath(filename))),
    onOpenInPopup: (message: AttachmentMessage) => dispatch(navigateAppend([{selected: 'attachment', props: {message}}])),
    onOpenInFileUI: (path: string) => dispatch(({type: 'fs:openInFileUI', payload: {path}}: OpenInFileUI)),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
    onAttach: (filename: string, title: string) => dispatchProps.onAttach(stateProps.selectedConversation, filename, title),
    onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversation),
    onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversation, messageID, filename),
    onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => !p.you).map(p => p.username).toArray()),
  }),
)(ConversationContainer)
