// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import {Box} from '../../common-adapters'
import {List, Map, is} from 'immutable'
import {connect} from 'react-redux'
import {deleteMessage, editMessage, loadMoreMessages, muteConversation, newChat, openFolder, postMessage, retryMessage, startConversation, loadAttachment, retryAttachment} from '../../actions/chat'
import * as ChatConstants from '../../constants/chat'
import {downloadFilePath} from '../../util/file'
import {getProfile} from '../../actions/tracker'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {onUserClick} from '../../actions/profile'
import {openDialog as openRekeyDialog} from '../../actions/unlock-folders'
import {pick} from 'lodash'
import {createSelectorCreator, defaultMemoize} from 'reselect'

import type {TypedState} from '../../constants/reducer'
import type {OpenInFileUI} from '../../constants/kbfs'
import type {ConversationIDKey, Message, AttachmentInput, AttachmentMessage, OpenAttachmentPopup, OutboxIDKey} from '../../constants/chat'
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

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, is)
const getYou = state => state.config.username || ''
const getSelectedConversation = props => props.routePath.last()
const getFollowingMap = (state, props) => state.config.following
const getMetaDataMap = state => state.chat.get('metaData')
const getConversationStates = (state, props) => state.chat.get('conversationStates').get(getSelectedConversation(state, props))
const getSelectedInbox = (state, props) => {
  const selectedConversation = getSelectedConversation(state, props)
  return state.chat.get('inbox').find(inbox => inbox.get('conversationIDKey') === selectedConversation)
}
const getRekeyInfo = (state, props) => state.chat.get('rekeyInfos').get(getSelectedConversation(state, props))
const getFinalizeInfo = (state, props) => state.chat.get('finalizedState').get(getSelectedConversation(state, props))
const getInputText = (state, props) => props.routeState.inputText
const getSupersedes = (state, props) => ChatConstants.convSupersedesInfo(getSelectedConversation(state, props), state.chat)
const getSupersededBy = (state, props) => ChatConstants.convSupersededByInfo(getSelectedConversation(state, props), state.chat)

const pendingSelector = createImmutableEqualSelector(
  [getYou, getSelectedConversation, getFollowingMap, getMetaDataMap, getInputText],
  (you, selectedConversation, followingMap, metaDataMap, inputText) => {
    const tlfName = pendingConversationIDKeyToTlfName(selectedConversation)
    if (tlfName) {
      const participants = tlfName.split(',')

      return {
        bannerMessage: null,
        emojiPickerOpen: false,
        followingMap: pick(followingMap, participants),
        inputText: inputText,
        isLoading: false,
        messages: List(),
        metaDataMap: metaDataMap.filter((k, v) => participants.includes(v)),
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
)

const normalSelector = createImmutableEqualSelector(
  [getSelectedConversation, getConversationStates, getYou, getFollowingMap, getMetaDataMap, getSelectedInbox, getRekeyInfo, getFinalizeInfo, getInputText, getSupersedes, getSupersededBy],
  (selectedConversation, conversationState, you, followingMap, metaDataMap, selectedInbox, rekeyInfo, finalizeInfo, inputText, supersedes, supersededBy) => {
    // console.log('aaaa normal selector', {you, selectedConversation, followingMap, metaDataMap, conversationStates, selectedInbox, rekeyInfo, finalizeInfo, inputText, supersedes, supersededBy})
    if (!conversationState) {
      return emptyState(you, selectedConversation)
    }

    const muted = selectedInbox && selectedInbox.get('muted')
    const participants = selectedInbox && selectedInbox.participants || List()
    return {
      bannerMessage: null,
      emojiPickerOpen: false,
      finalizeInfo,
      firstNewMessageID: conversationState.firstNewMessageID,
      followingMap: pick(followingMap, participants.toArray()),
      inputText: inputText,
      isLoading: conversationState.isLoading,
      messages: conversationState.messages,
      metaDataMap: metaDataMap.filter((k, v) => participants.contains(v)),
      moreToLoad: conversationState.moreToLoad,
      muted,
      participants,
      rekeyInfo,
      selectedConversation,
      supersededBy,
      supersedes,
      validated: selectedInbox && selectedInbox.validated,
      you,
    }
  }
)

const emptyState = (you, selectedConversation) => ({
  bannerMessage: null,
  followingMap: {},
  isLoading: false,
  messages: List(),
  metaDataMap: Map(),
  moreToLoad: false,
  participants: List(),
  rekeyInfo: null,
  selectedConversation,
  supersededBy: null,
  supersedes: null,
  validated: false,
  you,
})

const emptySelector = (state, props, selectedConversation) => {
  return createImmutableEqualSelector(
    [getYou],
    (you) => emptyState(you, selectedConversation)
  )
}

const selector = (state, props) => {
  const selectedConversation = getSelectedConversation(props)
  if (isPendingConversationIDKey(selectedConversation)) {
    return pendingSelector(state, props, selectedConversation)
  } else if (selectedConversation !== nothingSelected) {
    return normalSelector(state, props, selectedConversation)
  } else {
    return emptySelector(state, props, selectedConversation)
  }
}

export default connect(
  (state: TypedState, props) => {
    return selector(state, props)
  },
  (dispatch: Dispatch, {setRouteState}) => ({
    onAddParticipant: (participants: Array<string>) => dispatch(newChat(participants)),
    onAttach: (selectedConversation, inputs: Array<AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
    onBack: () => dispatch(navigateUp()),
    onDeleteMessage: (message: Message) => { dispatch(deleteMessage(message)) },
    onEditMessage: (message: Message, body: string) => { dispatch(editMessage(message, new HiddenString(body))) },
    onLoadAttachment: (selectedConversation, messageID, filename) => dispatch(loadAttachment(selectedConversation, messageID, false, false, downloadFilePath(filename))),
    onLoadMoreMessages: (conversationIDKey: ConversationIDKey) => dispatch(loadMoreMessages(conversationIDKey, false)),
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
    startConversation: (users: Array<string>) => dispatch(startConversation(users)),
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
      restartConversation: () => dispatchProps.startConversation(stateProps.participants.toArray()),
    }
  },
)(ConversationContainer)
