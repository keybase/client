// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import {downloadFilePath} from '../../util/file'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {deleteMessage, editMessage, loadMoreMessages, newChat, openFolder, postMessage, retryMessage, selectAttachment, loadAttachment} from '../../actions/chat'
import {nothingSelected} from '../../constants/chat'
import {onUserClick} from '../../actions/profile'
import {navigateAppend} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {ConversationIDKey, Message, AttachmentMessage} from '../../constants/chat'
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
  (state: TypedState, {routePath}) => {
    const selectedConversation = routePath.last()

    if (selectedConversation !== nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)

        return {
          bannerMessage: null,
          emojiPickerOpen: false,
          firstNewMessageID: conversationState.firstNewMessageID,
          isLoading: conversationState.isLoading,
          messages: conversationState.messages,
          metaData: state.chat.get('metaData'),
          moreToLoad: conversationState.moreToLoad,
          participants: selected && selected.participants || List(),
          selectedConversation,
          validated: selected && selected.validated,
        }
      }
    }

    return {
      bannerMessage: null,
      isLoading: false,
      messages: List(),
      metaData: Map(),
      moreToLoad: false,
      participants: List(),
      selectedConversation,
      validated: false,
    }
  },
  (dispatch: Dispatch) => ({
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, filename, title) => dispatch(selectAttachment(selectedConversation, filename, title)),
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onEditMessage: (message: Message) => { dispatch(editMessage(message)) },
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, downloadFilePath(filename))),
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
    onOpenFolder: () => dispatch(openFolder()),
    onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
    onOpenInPopup: (message: AttachmentMessage) => dispatch(navigateAppend([{props: {message}, selected: 'attachment'}])),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onRetryMessage: (outboxID: string) => dispatch(retryMessage(outboxID)),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => !p.you).map(p => p.username).toArray()),
    onAttach: (filename: string, title: string) => dispatchProps.onAttach(stateProps.selectedConversation, filename, title),
    onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversation, messageID, filename),
    onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversation),
    onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
  }),
)(ConversationContainer)
