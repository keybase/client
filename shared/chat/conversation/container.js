// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {loadMoreMessages, postMessage, openFolder, newChat} from '../../actions/chat'
import {onUserClick} from '../../actions/profile'

import type {TypedState} from '../../constants/reducer'
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
      this.setState({sidePanelOpen: false})
    }
  }

  render () {
    return <Conversation
      {...this.props}
      sidePanelOpen={this.state.sidePanelOpen}
      toggleSidePanel={() => this.setState({sidePanelOpen: !this.state.sidePanelOpen})} />
  }
}

export default connect(
  (state: TypedState) => {
    const selectedConversation = state.chat.get('selectedConversation')

    if (selectedConversation) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)

        return {
          participants: selected && selected.participants || List(),
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
          isLoading: conversationState.isLoading,
          selectedConversation,
          metaData: state.chat.get('metaData'),
        }
      }
    }

    return {
      participants: List(),
      messages: List(),
      moreToLoad: false,
      isLoading: false,
      selectedConversation,
      metaData: Map(),
    }
  },
  (dispatch: Dispatch) => ({
    loadMoreMessages: () => dispatch(loadMoreMessages()),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
    onOpenFolder: () => dispatch(openFolder()),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
    onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => !p.you).map(p => p.username).toArray()),
  }),
)(ConversationContainer)
