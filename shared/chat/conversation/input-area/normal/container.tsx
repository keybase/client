import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as TeamsTypes from '../../../../constants/types/teams'
import * as TeamsConstants from '../../../../constants/teams'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Waiting from '../../../../constants/waiting'
import * as Platform from '../../../../constants/platform'
import {assertionToDisplay} from '../../../../common-adapters/usernames'
import HiddenString from '../../../../util/hidden-string'
import * as Container from '../../../../util/container'
import {memoize} from '../../../../util/memoize'
import isEqual from 'lodash/isEqual'
import Input from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  maxInputArea?: number
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

const getTeams = memoize((layout: RPCChatTypes.UIInboxLayout | null) => {
  const bigTeams = (layout && layout.bigTeams) || []
  const smallTeams = (layout && layout.smallTeams) || []
  const bigTeamNames = bigTeams.reduce<Array<string>>((arr, l) => {
    if (l.state === RPCChatTypes.UIInboxBigTeamRowTyp.label) {
      arr.push(l.label.name)
    }
    return arr
  }, [])
  const smallTeamNames = smallTeams.reduce<Array<string>>((arr, l) => {
    if (l.isTeam) {
      arr.push(l.name)
    }
    return arr
  }, [])
  return bigTeamNames
    .concat(smallTeamNames)
    .sort()
    .map(teamname => ({fullName: '', teamname, username: ''}))
})

const noChannel: Array<{channelname: string}> = []
let _channelSuggestions: Array<{channelname: string; teamname?: string}> = noChannel

const getChannelSuggestions = (
  state: Container.TypedState,
  teamname: string,
  _: TeamsTypes.TeamID,
  convID?: Types.ConversationIDKey
) => {
  if (!teamname) {
    // this is an impteam, so get mutual teams from state
    if (!convID) {
      return noChannel
    }
    const mutualTeams = (state.chat2.mutualTeamMap.get(convID) ?? []).map(teamID =>
      TeamsConstants.getTeamNameFromID(state, teamID)
    )
    if (!mutualTeams) {
      return noChannel
    }
    // TODO: maybe we shouldn't rely on this inboxlayout being around?
    const suggestions = (state.chat2.inboxLayout?.bigTeams ?? []).reduce<
      Array<{channelname: string; teamname: string}>
    >((arr, t) => {
      if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
        if (mutualTeams.includes(t.channel.teamname)) {
          arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
        }
      }
      return arr
    }, [])

    if (!isEqual(_channelSuggestions, suggestions)) {
      _channelSuggestions = suggestions
    }
    return _channelSuggestions
  }
  // TODO: get all the channels in the team, too, for this
  const suggestions = (state.chat2.inboxLayout?.bigTeams ?? []).reduce<Array<{channelname: string}>>(
    (arr, t) => {
      if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
        if (t.channel.teamname === teamname) {
          arr.push({channelname: t.channel.channelname})
        }
      }
      return arr
    },
    []
  )

  if (!isEqual(_channelSuggestions, suggestions)) {
    _channelSuggestions = suggestions
  }
  return _channelSuggestions
}

const getInputHintText = (
  state: Container.TypedState,
  conversationIDKey: Types.ConversationIDKey
): string | undefined => {
  const meta = Constants.getMeta(state, conversationIDKey)
  if (meta.teamType === 'big') {
    return meta.channelname
      ? `Write in ${Platform.isMobile ? '' : `@${meta.teamname}`}#${meta.channelname}`
      : undefined
  }
  if (meta.teamType === 'small') {
    return meta.teamname ? `Write in @${meta.teamname}` : undefined
  }
  if (meta.teamType === 'adhoc') {
    const participantInfo = state.chat2.participantMap.get(conversationIDKey) || Constants.noParticipantInfo
    if (participantInfo.name.length > 2) {
      return 'Message group'
    } else if (participantInfo.name.length === 2) {
      const other = participantInfo.name.find(n => n !== state.config.username)
      if (!other) {
        return undefined
      }
      const otherText = other.includes('@') ? assertionToDisplay(other) : `@${other}`
      return otherText.length < 20 ? `Message ${otherText}` : undefined
    } else if (participantInfo.name.length === 1) {
      return 'Message yourself'
    }
    return undefined
  }
  return undefined
}

export default Container.namedConnect(
  (state, {conversationIDKey}: OwnProps) => {
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    const quoteInfo = Constants.getQuoteInfo(state, conversationIDKey)
    const meta = Constants.getMeta(state, conversationIDKey)
    const isSearching = Constants.getThreadSearchInfo(state, conversationIDKey).visible
    // don't include 'small' here to ditch the single #general suggestion
    const teamname = meta.teamType === 'big' ? meta.teamname : ''
    const inputHintText = getInputHintText(state, conversationIDKey)

    const _you = state.config.username

    const explodingModeSeconds = Constants.getConversationExplodingMode(state, conversationIDKey)
    const isExploding = explodingModeSeconds !== 0
    const unsentText = state.chat2.unsentTextMap.get(conversationIDKey)
    const prependText = state.chat2.prependTextMap.get(conversationIDKey)
    const showCommandMarkdown = (state.chat2.commandMarkdownMap.get(conversationIDKey) || '') !== ''
    const showCommandStatus = !!state.chat2.commandStatusMap.get(conversationIDKey)
    const showGiphySearch = state.chat2.giphyWindowMap.get(conversationIDKey) || false
    const _replyTo = Constants.getReplyToMessageID(state, conversationIDKey)
    const _containsLatestMessage = state.chat2.containsLatestMessageMap.get(conversationIDKey) || false
    const suggestBotCommandsUpdateStatus =
      state.chat2.botCommandsUpdateStatusMap.get(conversationIDKey) ||
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank
    const botSettings = state.chat2.botSettings.get(conversationIDKey)

    return {
      _botSettings: botSettings,
      _containsLatestMessage,
      _draft: Constants.getDraft(state, conversationIDKey),
      _editOrdinal: editInfo ? editInfo.ordinal : null,
      _inboxLayout: state.chat2.inboxLayout,
      _isExplodingModeLocked: Constants.isExplodingModeLocked(state, conversationIDKey),
      _replyTo,
      _you,
      cannotWrite: meta.cannotWrite,
      conversationIDKey,
      editText: editInfo ? editInfo.text : '',
      explodingModeSeconds,
      infoPanelShowing: state.chat2.infoPanelShowing,
      inputHintText,
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
      suggestBotCommands: Constants.getBotCommands(state, conversationIDKey),
      suggestBotCommandsUpdateStatus,
      suggestChannels: getChannelSuggestions(state, teamname, meta.teamID, conversationIDKey),
      suggestChannelsLoading: Waiting.anyWaiting(
        state,
        TeamsConstants.getChannelsWaitingKey(meta.teamID),
        Constants.waitingKeyMutualTeams(conversationIDKey)
      ),
      suggestCommands: Constants.getCommands(state, conversationIDKey),
      suggestTeams: getTeams(state.chat2.inboxLayout),
      suggestUsers: Constants.getParticipantSuggestions(state, conversationIDKey),
      typing: Constants.getTyping(state, conversationIDKey),
      unsentText,
      userEmojis: state.chat2.userEmojisForAutocomplete,
      userEmojisLoading: Waiting.anyWaiting(state, Constants.waitingKeyLoadingEmoji),
    }
  },
  dispatch => ({
    _clearPrependText: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(Chat2Gen.createSetPrependText({conversationIDKey, text: null}))
    },
    _clearUnsentText: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(Chat2Gen.createSetUnsentText({conversationIDKey}))
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
    _onFetchEmoji: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey})),
    _onGiphyToggle: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createToggleGiphyPrefill({conversationIDKey})),
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
    onChannelSuggestionsTriggered: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createChannelSuggestionsTriggered({conversationIDKey})),
    onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
    onSetExplodingModeLock: (conversationIDKey: Types.ConversationIDKey, unset: boolean) =>
      dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const botRestrictMap = stateProps._botSettings
      ? Constants.getBotRestrictBlockMap(stateProps._botSettings, stateProps.conversationIDKey, [
          ...stateProps.suggestBotCommands
            .reduce<Set<string>>((s, c) => {
              if (c.username) {
                s.add(c.username)
              }
              return s
            }, new Set())
            .values(),
        ])
      : undefined
    return {
      botRestrictMap,
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
          const draft = stateProps._draft
          if (draft) {
            return draft
          }
        }
        return ret
      },
      infoPanelShowing: stateProps.infoPanelShowing,
      inputHintText: stateProps.inputHintText,
      isActiveForFocus: stateProps.isActiveForFocus,
      isEditExploded: stateProps.isEditExploded,
      isEditing: !!stateProps._editOrdinal,
      isExploding: stateProps.isExploding,
      isSearching: stateProps.isSearching,
      maxInputArea: ownProps.maxInputArea,
      minWriterRole: stateProps.minWriterRole,
      onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
      onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
      onCancelReply: () => dispatchProps._onCancelReply(stateProps.conversationIDKey),
      onChannelSuggestionsTriggered: () =>
        dispatchProps.onChannelSuggestionsTriggered(stateProps.conversationIDKey),
      onEditLastMessage: () =>
        dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
      onFetchEmoji: () => dispatchProps._onFetchEmoji(stateProps.conversationIDKey),
      onFilePickerError: dispatchProps.onFilePickerError,
      onGiphyToggle: () => dispatchProps._onGiphyToggle(stateProps.conversationIDKey),
      onRequestScrollDown: ownProps.onRequestScrollDown,
      onRequestScrollUp: ownProps.onRequestScrollUp,
      onSubmit: (text: string) => {
        if (stateProps._editOrdinal) {
          dispatchProps._onEditMessage(stateProps.conversationIDKey, stateProps._editOrdinal, text)
        } else {
          dispatchProps._onPostMessage(stateProps.conversationIDKey, text, stateProps._replyTo || null)
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
        const set = text.length > 0
        if (stateProps._isExplodingModeLocked !== set) {
          // if it's locked and we want to unset, unset it
          // alternatively, if it's not locked and we want to set it, set it
          dispatchProps.onSetExplodingModeLock(stateProps.conversationIDKey, !set)
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
      suggestAllChannels: (stateProps._inboxLayout?.bigTeams ?? []).reduce<
        Array<{teamname: string; channelname: string}>
      >((arr, t) => {
        if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
          arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
        }
        return arr
      }, []),
      suggestBotCommands: stateProps.suggestBotCommands,
      suggestBotCommandsUpdateStatus: stateProps.suggestBotCommandsUpdateStatus,
      suggestChannels: stateProps.suggestChannels,
      suggestChannelsLoading: stateProps.suggestChannelsLoading,
      suggestCommands: stateProps.suggestCommands,
      suggestTeams: stateProps.suggestTeams,
      suggestUsers: stateProps.suggestUsers,
      unsentText: stateProps.unsentText ? stateProps.unsentText.stringValue() : null,
      unsentTextChanged: (text: string) => {
        dispatchProps._unsentTextChanged(stateProps.conversationIDKey, text)
      },
      userEmojis: stateProps.userEmojis,
      userEmojisLoading: stateProps.userEmojisLoading,
    }
  },
  'Input'
)(Input)
