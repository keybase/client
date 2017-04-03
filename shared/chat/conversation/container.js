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

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
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

  // We wrap this so children don't churn when this.props.onBack() changes due to this component churning. When this thing does less we can
  // likely remove this
  _onBack = () => {
    this.props.onBack()
  }

  render () {
    if (!this.props.selectedConversation) {
      return <Box style={{flex: 1}} />
    }

    return <Conversation
      {...this.props}
      sidePanelOpen={this.state.sidePanelOpen}
      onToggleSidePanel={this._onToggleSidePanel}
      onBack={this._onBack}
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

    if (Constants.isPendingConversationIDKey(selectedConversation)) {
      const tlfName = Constants.pendingConversationIDKeyToTlfName(selectedConversation)
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
          threadLoadedOffline: false,
          you,
        }
      }
    }

    if (selectedConversation !== Constants.nothingSelected) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)
        const muted = selected && selected.get('status') === 'muted'
        const participants = selected && selected.participants || List()
        const rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversation)

        const supersedes = Constants.convSupersedesInfo(selectedConversation, state.chat)
        const supersededBy = Constants.convSupersededByInfo(selectedConversation, state.chat)
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
      isLoading: false,
      messages: List(),
      metaDataMap: Map(),
      moreToLoad: false,
      participants: List(),
      rekeyInfo: null,
      selectedConversation,
      validated: false,
      threadLoadedOffline: false,
      you,
      supersedes: null,
      supersededBy: null,
    }
  },
  (dispatch: Dispatch, {setRouteState, navigateUp}) => ({
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
    onPostMessage: (selectedConversation, text) => dispatch(Creators.postMessage(selectedConversation, new HiddenString(text))),
    onRetryAttachment: (message: Constants.AttachmentMessage) => dispatch(Creators.retryAttachment(message)),
    onRetryMessage: (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) => dispatch(Creators.retryMessage(conversationIDKey, outboxID)),
    onSelectAttachment: (conversationIDKey: Constants.ConversationIDKey, input: Constants.AttachmentInput) => dispatch(Creators.selectAttachment(input)),
    startConversation: (users: Array<string>) => dispatch(Creators.startConversation(users, true)),
    onStoreInputText: (inputText: string) => setRouteState({inputText: new HiddenString(inputText)}),
    onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
    onShowTracker: (username: string) => dispatch(getProfile(username, true, true)),
    onRekey: () => dispatch(openRekeyDialog()),
    onEnterPaperkey: () => dispatch(navigateAppend(['enterPaperkey'])),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
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
      ...ownProps,
      bannerMessage,
      onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.filter(p => p !== stateProps.you).toArray()),
      onAttach: (inputs: Array<Constants.AttachmentInput>) => dispatchProps.onAttach(stateProps.selectedConversation, inputs),
      onLoadAttachment: (messageID, filename) => dispatchProps.onLoadAttachment(stateProps.selectedConversation, messageID, filename),
      onLoadMoreMessages: () => dispatchProps.onLoadMoreMessages(stateProps.selectedConversation),
      onMuteConversation: (muted: boolean) => dispatchProps.onMuteConversation(stateProps.selectedConversation, muted),
      onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
      onRetryMessage: (outboxID: Constants.OutboxIDKey) => dispatchProps.onRetryMessage(stateProps.selectedConversation, outboxID),
      onSelectAttachment: (input) => dispatchProps.onSelectAttachment(stateProps.selectedConversation, input),
      onShowBlockConversationDialog: () => dispatchProps.onShowBlockConversationDialog(stateProps.selectedConversation, stateProps.participants.toArray().join(',')),
      restartConversation: () => dispatchProps.startConversation(stateProps.participants.toArray()),
    }
  },
)(ConversationContainer)
