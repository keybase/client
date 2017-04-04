// @flow
import * as Constants from '../../constants/chat'
import * as Creators from '../../actions/chat/creators'
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map} from 'immutable'
import {connect} from 'react-redux'
import {downloadFilePath} from '../../util/file'
import {getProfile} from '../../actions/tracker'
import {navigateAppend} from '../../actions/route-tree'
import {onUserClick} from '../../actions/profile'
import {openDialog as openRekeyDialog} from '../../actions/unlock-folders'
import {pick} from 'lodash'
import {withState, withHandlers, compose} from 'recompose'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {Props} from '.'

type ConversationContainerProps = {
  onCloseSidePanel: () => void,
  onToggleSidePanel: () => void,
  sidePanelOpen: boolean,
  listScrollDownCounter: number,
  onEditLastMessage: () => void,
  onFocus: () => void,
  onScrollDown: () => void,
} & Props

class ConversationContainer extends Component<void, ConversationContainerProps, void> {
  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
      this.props.onCloseSidePanel()
    }
  }

  // We wrap this so children don't churn when this.props.onBack() changes due to this component churning. When this thing does less we can
  // likely remove this
  _onBack = () => {
    this.props.onBack()
  }
  render () {
    if (!this.props.selectedConversationIDKey) {
      return <Box style={{flex: 1}} />
    }

    return <Conversation
      {...this.props}
      sidePanelOpen={this.props.sidePanelOpen}
      onToggleSidePanel={this.props.onToggleSidePanel}
      onBack={this._onBack}
      onScrollDown={this.props.onScrollDown}
      listScrollDownState={this.props.listScrollDownCounter}
      onFocus={this.props.onFocus}
      onEditLastMessage={this.props.onEditLastMessage}
    />
  }
}

const mapStateToProps = (state: TypedState, {routePath, routeState}) => {
  const selectedConversationIDKey = routePath.last()

  const you = state.config.username || ''
  const followingMap = state.config.following
  const metaDataMap = state.chat.get('metaData')

  if (Constants.isPendingConversationIDKey(selectedConversationIDKey)) {
    const tlfName = Constants.pendingConversationIDKeyToTlfName(selectedConversationIDKey)
    if (tlfName) {
      const participants = List(tlfName.split(','))

      return {
        followingMap: pick(followingMap, participants.toArray()),
        messages: List(),
        metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
        moreToLoad: false,
        participants,
        rekeyInfo: null,
        selectedConversationIDKey,
        validated: true,
        threadLoadedOffline: false,
        you,
      }
    }
  }

  if (selectedConversationIDKey !== Constants.nothingSelected) {
    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      const inbox = state.chat.get('inbox')
      const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)
      const participants = selected && selected.participants || List()
      const rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversationIDKey)

      const supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
      const supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)
      const finalizeInfo = state.chat.get('finalizedState').get(selectedConversationIDKey)

      return {
        firstNewMessageID: conversationState.firstNewMessageID,
        followingMap: pick(followingMap, participants.toArray()),
        messages: conversationState.messages,
        metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
        moreToLoad: conversationState.moreToLoad,
        participants,
        rekeyInfo,
        selectedConversationIDKey,
        validated: selected && selected.state === 'unboxed',
        you,
        supersedes,
        supersededBy,
        threadLoadedOffline: conversationState.loadedOffline,
        finalizeInfo,
        editingMessage: state.chat.get('editingMessage'),
      }
    }
  }

  return {
    followingMap,
    messages: List(),
    metaDataMap: Map(),
    moreToLoad: false,
    participants: List(),
    rekeyInfo: null,
    selectedConversationIDKey,
    validated: false,
    threadLoadedOffline: false,
    you,
    supersedes: null,
    supersededBy: null,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {setRouteState, navigateUp}) => ({
  onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
  onBack: () => dispatch(navigateUp()),
  onDeleteMessage: (message: Constants.Message) => { dispatch(Creators.deleteMessage(message)) },
  onEditMessage: (message: Constants.Message, body: string) => { dispatch(Creators.editMessage(message, new HiddenString(body))) },
  onShowEditor: (message: Constants.Message) => { dispatch(Creators.showEditor(message)) },
  onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(Creators.loadAttachment(selectedConversation, messageID, downloadFilePath(filename), false, false)),
  onLoadMoreMessages: (conversationIDKey: Constants.ConversationIDKey) => dispatch(Creators.loadMoreMessages(conversationIDKey, false)),
  onMessageAction: (message: Constants.ServerMessage) => dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
  onOpenFolder: () => dispatch(Creators.openFolder()),
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) => dispatch(Creators.openConversation(conversationIDKey)),
  onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
  onOpenInPopup: (message: Constants.AttachmentMessage) => dispatch(Creators.openAttachmentPopup(message)),
  onRetryAttachment: (message: Constants.AttachmentMessage) => dispatch(Creators.retryAttachment(message)),
  onRetryMessage: (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) => dispatch(Creators.retryMessage(conversationIDKey, outboxID)),
  startConversation: (users: Array<string>) => dispatch(Creators.startConversation(users, true)),
  onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
  onShowTracker: (username: string) => dispatch(getProfile(username, true, true)),
  onRekey: () => dispatch(openRekeyDialog()),
  onEnterPaperkey: () => dispatch(navigateAppend(['enterPaperkey'])),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onAttach: (inputs: Array<Constants.AttachmentInput>) => dispatchProps.onAttach(stateProps.selectedConversationIDKey, inputs),
    onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversationIDKey, messageID, filename),
    onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversationIDKey),
    onRetryMessage: (outboxID: Constants.OutboxIDKey) => dispatchProps.onRetryMessage(stateProps.selectedConversationIDKey, outboxID),
    restartConversation: () => dispatchProps.startConversation(stateProps.participants.toArray()),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withState('sidePanelOpen', 'setSidePanelOpen', false),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withState('editLastMessageCounter', 'setEditLastMessageCounter', 0),
  withState('listScrollDownCounter', 'setListScrollDownCounter', 0),
  withHandlers({
    onCloseSidePanel: props => () => props.setSidePanelOpen(false),
    onEditLastMessage: props => () => props.setEditLastMessageCounter(props.editLastMessageCounter + 1),
    onFocus: props => () => props.setFocusInputCounter(props.focusInputCounter + 1),
    onScrollDown: props => () => props.setListScrollDownCounter(props.listScrollDownCounter + 1),
    onToggleSidePanel: props => () => props.setSidePanelOpen(!props.sidePanelOpen),
  }),
)(ConversationContainer)
