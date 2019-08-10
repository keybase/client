import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import HiddenString from '../../../../util/hidden-string'
import {namedConnect} from '../../../../util/container'
import {memoize} from '../../../../util/memoize'
import Input, {Props} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

// We used to store this in the route state but that's so complicated. We just want a map of id => text if we haven't sent
const unsentText: {[K in Types.ConversationIDKey]: string} = {}

const getUnsentText = (conversationIDKey: Types.ConversationIDKey): string => {
  return unsentText[conversationIDKey] || ''
}

const setUnsentText = (conversationIDKey: Types.ConversationIDKey, text: string) => {
  unsentText[conversationIDKey] = text
}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, conversationIDKey)
  const quoteInfo = Constants.getQuoteInfo(state, conversationIDKey)
  const meta = Constants.getMeta(state, conversationIDKey)
  const isSearching = Constants.getThreadSearchInfo(state, conversationIDKey).visible
  // don't include 'small' here to ditch the single #general suggestion
  const teamname = meta.teamType === 'big' ? meta.teamname : ''

  const _you = state.config.username || ''

  const explodingModeSeconds = Constants.getConversationExplodingMode(state, conversationIDKey)
  const isExploding = explodingModeSeconds !== 0
  const unsentText = state.chat2.unsentTextMap.get(conversationIDKey)
  const prependText = state.chat2.prependTextMap.get(conversationIDKey)
  const showCommandMarkdown = state.chat2.commandMarkdownMap.get(conversationIDKey, '') !== ''
  const showCommandStatus = !!state.chat2.commandStatusMap.get(conversationIDKey, null)
  const showGiphySearch = state.chat2.giphyWindowMap.get(conversationIDKey, false)
  const _replyTo = Constants.getReplyToMessageID(state, conversationIDKey)
  const _containsLatestMessage = state.chat2.containsLatestMessageMap.get(conversationIDKey, false)
  const suggestBotCommandsUpdateStatus = state.chat2.botCommandsUpdateStatusMap.get(
    conversationIDKey,
    RPCChatTypes.UIBotCommandsUpdateStatus.blank
  )
  return {
    _containsLatestMessage,
    _editOrdinal: editInfo ? editInfo.ordinal : null,
    _isExplodingModeLocked: Constants.isExplodingModeLocked(state, conversationIDKey),
    _metaMap: state.chat2.metaMap,
    _replyTo,
    _you,
    cannotWrite: meta.cannotWrite,
    conversationIDKey,
    editText: editInfo ? editInfo.text : '',
    explodingModeSeconds,
    isActiveForFocus: state.chat2.focus === null,
    isEditExploded: editInfo ? editInfo.exploded : false,
    isExploding,
    isSearching,
    minWriterRole: meta.minWriterRole,
    prependText,
    quoteCounter: quoteInfo ? quoteInfo.counter : 0,
    quoteText: quoteInfo ? quoteInfo.text : '',
    showCommandMarkdown,
    showCommandStatus,
    showGiphySearch,
    showTypingStatus:
      Constants.getTyping(state, conversationIDKey).size !== 0 && !showGiphySearch && !showCommandMarkdown,
    showWalletsIcon: Constants.shouldShowWalletsIcon(state, conversationIDKey),
    suggestAllChannels: Constants.getAllChannels(state),
    suggestBotCommands: Constants.getBotCommands(state, conversationIDKey),
    suggestBotCommandsUpdateStatus,
    suggestChannels: Constants.getChannelSuggestions(state, teamname),
    suggestCommands: Constants.getCommands(state, conversationIDKey),
    suggestUsers: Constants.getParticipantSuggestions(state, conversationIDKey),
    typing: Constants.getTyping(state, conversationIDKey),
    unsentText,
  }
}

const mapDispatchToProps = dispatch => ({
  _clearPrependText: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createSetPrependText({conversationIDKey, text: null}))
  },
  _clearUnsentText: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createSetUnsentText({conversationIDKey, text: null}))
  },
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({
      outboxID: null,
      path: p,
    }))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
      })
    )
  },
  _onCancelEditing: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null})),
  _onCancelReply: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey})),
  _onEditLastMessage: (conversationIDKey: Types.ConversationIDKey, you: string) =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: you,
        ordinal: null,
      })
    ),
  _onEditMessage: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey,
        ordinal,
        text: new HiddenString(body),
      })
    ),
  _onPostMessage: (
    conversationIDKey: Types.ConversationIDKey,
    text: string,
    replyTo: Types.MessageID | null
  ) =>
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        replyTo: replyTo || undefined,
        text: new HiddenString(text),
      })
    ),
  _sendTyping: (conversationIDKey: Types.ConversationIDKey, typing: boolean) =>
    conversationIDKey && dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing})),
  _unsentTextChanged: (conversationIDKey: Types.ConversationIDKey, text: string) =>
    conversationIDKey &&
    dispatch(Chat2Gen.createUnsentTextChanged({conversationIDKey, text: new HiddenString(text)})),
  clearInboxFilter: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
  onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
  onSetExplodingModeLock: (conversationIDKey: Types.ConversationIDKey, unset: boolean) =>
    dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset})),
})

const getTeams = memoize(metaMap =>
  Constants.getTeams(metaMap)
    .map(t => ({fullName: '', teamname: t, username: ''}))
    .sort((a, b) => a.teamname.localeCompare(b.teamname))
)

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  cannotWrite: stateProps.cannotWrite,
  clearInboxFilter: dispatchProps.clearInboxFilter,
  conversationIDKey: stateProps.conversationIDKey,
  editText: stateProps.editText,
  explodingModeSeconds: stateProps.explodingModeSeconds,
  focusInputCounter: ownProps.focusInputCounter,

  getUnsentText: () => {
    // if we have unsent text in the store, that wins, otherwise take what we have stored locally
    const unsentText = stateProps.unsentText
      ? stateProps.unsentText.stringValue()
      : getUnsentText(stateProps.conversationIDKey)
    // The store can also have text to prepend, so do that here
    const ret = stateProps.prependText ? stateProps.prependText.stringValue() + unsentText : unsentText
    // If we have nothing still, check to see if the service told us about a draft and fill that in
    if (!ret) {
      const meta = stateProps._metaMap.get(stateProps.conversationIDKey)
      if (meta && meta.draft) {
        return meta.draft
      }
    }
    return ret
  },

  isActiveForFocus: stateProps.isActiveForFocus,
  isEditExploded: stateProps.isEditExploded,
  isEditing: !!stateProps._editOrdinal,
  isExploding: stateProps.isExploding,
  isSearching: stateProps.isSearching,
  minWriterRole: stateProps.minWriterRole,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onCancelReply: () => dispatchProps._onCancelReply(stateProps.conversationIDKey),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onFilePickerError: dispatchProps.onFilePickerError,
  onRequestScrollDown: ownProps.onRequestScrollDown,
  onRequestScrollUp: ownProps.onRequestScrollUp,

  onSubmit: (text: string) => {
    if (stateProps._editOrdinal) {
      dispatchProps._onEditMessage(stateProps.conversationIDKey, stateProps._editOrdinal, text)
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text, stateProps._replyTo)
    }
    if (stateProps._containsLatestMessage) {
      ownProps.onRequestScrollToBottom()
    } else {
      ownProps.jumpToRecent()
    }
  },
  prependText: stateProps.prependText ? stateProps.prependText.stringValue() : null,

  quoteCounter: stateProps.quoteCounter,
  quoteText: stateProps.quoteText,

  sendTyping: (typing: boolean) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, typing)
  },

  setUnsentText: (text: string) => {
    const unset = text.length <= 0
    if (stateProps._isExplodingModeLocked ? unset : !unset) {
      // if it's locked and we want to unset, unset it
      // alternatively, if it's not locked and we want to set it, set it
      dispatchProps.onSetExplodingModeLock(stateProps.conversationIDKey, unset)
    }
    // The store text only lasts until we change it, so blow it away now
    if (stateProps.unsentText) {
      dispatchProps._clearUnsentText(stateProps.conversationIDKey)
    }
    if (stateProps.prependText) {
      if (text !== stateProps.prependText.stringValue()) {
        dispatchProps._clearPrependText(stateProps.conversationIDKey)
      } else {
        // don't set the uncontrolled text tracker to the prepend text by itself, since we want to be
        // able to remove it if the person doesn't change it at all.
        return
      }
    }
    setUnsentText(stateProps.conversationIDKey, text)
  },

  showCommandMarkdown: stateProps.showCommandMarkdown,
  showCommandStatus: stateProps.showCommandStatus,
  showGiphySearch: stateProps.showGiphySearch,
  showReplyPreview: !!stateProps._replyTo,
  showTypingStatus: stateProps.showTypingStatus,
  showWalletsIcon: stateProps.showWalletsIcon,
  suggestAllChannels: stateProps.suggestAllChannels,
  suggestBotCommands: stateProps.suggestBotCommands,
  suggestBotCommandsUpdateStatus: stateProps.suggestBotCommandsUpdateStatus,
  suggestChannels: stateProps.suggestChannels,
  suggestCommands: stateProps.suggestCommands,
  suggestTeams: getTeams(stateProps._metaMap),
  suggestUsers: stateProps.suggestUsers,
  unsentText: stateProps.unsentText ? stateProps.unsentText.stringValue() : null,
  unsentTextChanged: (text: string) => {
    dispatchProps._unsentTextChanged(stateProps.conversationIDKey, text)
  },
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Input')(Input)
