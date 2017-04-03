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
import {isMobile} from '../../constants/platform'
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

  // We wrap this so children don't churn when this.props.onBack() changes due to this component churning. Whe this thing does less we can
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
        bannerMessage: null,
        followingMap: pick(followingMap, participants.toArray()),
        messages: List(),
        metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
        moreToLoad: false,
        muted: false,
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
      const muted = selected && selected.get('status') === 'muted'
      const participants = selected && selected.participants || List()
      const rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversationIDKey)

      const supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
      const supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)
      const finalizeInfo = state.chat.get('finalizedState').get(selectedConversationIDKey)

      return {
        bannerMessage: null,
        firstNewMessageID: conversationState.firstNewMessageID,
        followingMap: pick(followingMap, participants.toArray()),
        messages: conversationState.messages,
        metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
        moreToLoad: conversationState.moreToLoad,
        muted,
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
    bannerMessage: null,
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
  onAddParticipant: (participants: Array<string>) => dispatch(Creators.newChat(participants)),
  onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
  onBack: () => dispatch(navigateUp()),
  onBannerWarning: (username: string) => { isMobile ? dispatch(onUserClick(username, '')) : dispatch(getProfile(username, true, true)) },
  onDeleteMessage: (message: Constants.Message) => { dispatch(Creators.deleteMessage(message)) },
  onEditMessage: (message: Constants.Message, body: string) => { dispatch(Creators.editMessage(message, new HiddenString(body))) },
  onShowBlockConversationDialog: (selectedConversation, participants) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, participants}, selected: 'showBlockConversationDialog'}])) },
  onShowEditor: (message: Constants.Message) => { dispatch(Creators.showEditor(message)) },
  onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(Creators.loadAttachment(selectedConversation, messageID, downloadFilePath(filename), false, false)),
  onLoadMoreMessages: (conversationIDKey: Constants.ConversationIDKey) => dispatch(Creators.loadMoreMessages(conversationIDKey, false)),
  onMessageAction: (message: Constants.ServerMessage) => dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
  onMuteConversation: (conversationIDKey: Constants.ConversationIDKey, muted: boolean) => { dispatch(Creators.muteConversation(conversationIDKey, muted)) },
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
  let bannerMessage

  const brokenUsers = Constants.getBrokenUsers(stateProps.participants.toArray(), stateProps.you, stateProps.metaDataMap)
  if (brokenUsers.length) {
    bannerMessage = {
      onClick: (user: string) => dispatchProps.onBannerWarning(user),
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
    bannerMessage,
    onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => p !== stateProps.you).toArray()),
    onAttach: (inputs: Array<Constants.AttachmentInput>) => dispatchProps.onAttach(stateProps.selectedConversationIDKey, inputs),
    onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversationIDKey, messageID, filename),
    onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversationIDKey),
    onMuteConversation: (muted: boolean) => dispatchProps.onMuteConversation(stateProps.selectedConversationIDKey, muted),
    onRetryMessage: (outboxID: Constants.OutboxIDKey) => dispatchProps.onRetryMessage(stateProps.selectedConversationIDKey, outboxID),
    onShowBlockConversationDialog: () => dispatchProps.onShowBlockConversationDialog(stateProps.selectedConversationIDKey, stateProps.participants.toArray().join(',')),
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
