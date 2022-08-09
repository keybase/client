import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import PlatformInput from './platform-input'
import ReplyPreview from '../../reply-preview'
import type * as Types from '../../../../constants/types/chat2'
import {indefiniteArticle} from '../../../../util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {isLargeScreen} from '../../../../constants/platform'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
// import * as TeamsConstants from '../../../../constants/teams'
// import * as Waiting from '../../../../constants/waiting'
import * as Platform from '../../../../constants/platform'
import {assertionToDisplay} from '../../../../common-adapters/usernames'

const unsentTextMap = new Map<Types.ConversationIDKey, string>()

type Props = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  maxInputArea?: number
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
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

const Input = (p: Props) => {
  const {
    conversationIDKey,
    maxInputArea,
    onRequestScrollDown,
    onRequestScrollUp,
    onRequestScrollToBottom,
    jumpToRecent,
    focusInputCounter,
  } = p

  const editInfo = Container.useSelector(state => Constants.getEditInfo(state, conversationIDKey))
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  // const isSearching = Container.useSelector(
  //   state => Constants.getThreadSearchInfo(state, conversationIDKey).visible
  // )
  const inputHintText = Container.useSelector(state => getInputHintText(state, conversationIDKey))
  // const _you = Container.useSelector(state => state.config.username)
  const explodingModeSeconds = Container.useSelector(state =>
    Constants.getConversationExplodingMode(state, conversationIDKey)
  )
  const isExploding = explodingModeSeconds !== 0
  // const unsentText = Container.useSelector(state => state.chat2.unsentTextMap.get(conversationIDKey))
  const showCommandMarkdown = Container.useSelector(
    state => (state.chat2.commandMarkdownMap.get(conversationIDKey) || '') !== ''
  )
  const showCommandStatus = Container.useSelector(
    state => !!state.chat2.commandStatusMap.get(conversationIDKey)
  )
  const showGiphySearch = Container.useSelector(
    state => state.chat2.giphyWindowMap.get(conversationIDKey) || false
  )
  const _replyTo = Container.useSelector(state => Constants.getReplyToMessageID(state, conversationIDKey))
  const _containsLatestMessage = Container.useSelector(
    state => state.chat2.containsLatestMessageMap.get(conversationIDKey) || false
  )
  const suggestBotCommandsUpdateStatus = Container.useSelector(
    state =>
      state.chat2.botCommandsUpdateStatusMap.get(conversationIDKey) ||
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank
  )

  // const _draft = Container.useSelector(state => Constants.getDraft(state, conversationIDKey))
  const _editOrdinal = editInfo ? editInfo.ordinal : null
  const cannotWrite = meta.cannotWrite
  const infoPanelShowing = Container.useSelector(state => state.chat2.infoPanelShowing)
  const isActiveForFocus = Container.useSelector(state => state.chat2.focus === null)
  const isEditExploded = editInfo ? editInfo.exploded : false
  const minWriterRole = meta.minWriterRole
  const showTypingStatus = Container.useSelector(
    state =>
      Constants.getTyping(state, conversationIDKey).size !== 0 && !showGiphySearch && !showCommandMarkdown
  )
  const showWalletsIcon = Container.useSelector(state =>
    Constants.shouldShowWalletsIcon(state, conversationIDKey)
  )
  // const suggestChannelsLoading = Container.useSelector(state =>
  //   Waiting.anyWaiting(
  //     state,
  //     TeamsConstants.getChannelsWaitingKey(meta.teamID),
  //     Constants.waitingKeyMutualTeams(conversationIDKey)
  //   )
  // )
  // const suggestCommands = Container.useSelector(state => Constants.getCommands(state, conversationIDKey))
  // const typing = Container.useSelector(state => Constants.getTyping(state, conversationIDKey))

  const _onEditMessage = (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey,
        ordinal,
        text: new Container.HiddenString(body),
      })
    )
  const _onPostMessage = (
    conversationIDKey: Types.ConversationIDKey,
    text: string,
    replyTo: Types.MessageID | null
  ) =>
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        replyTo: replyTo || undefined,
        text: new Container.HiddenString(text),
      })
    )
  const _sendTyping = (conversationIDKey: Types.ConversationIDKey, typing: boolean) =>
    conversationIDKey && dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing}))
  // const clearInboxFilter = () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false}))

  const isEditing = !!_editOrdinal
  const onSubmit = (text: string) => {
    if (_editOrdinal) {
      _onEditMessage(conversationIDKey, _editOrdinal, text)
    } else {
      _onPostMessage(conversationIDKey, text, _replyTo || null)
    }
    if (_containsLatestMessage) {
      onRequestScrollToBottom()
    } else {
      jumpToRecent()
    }
  }
  const sendTyping = (typing: boolean) => {
    _sendTyping(conversationIDKey, typing)
  }
  const showReplyPreview = !!_replyTo

  const inputRef = React.useRef<Kb.PlainInput | null>(null)

  const isExplodingModeLocked = Container.useSelector(state =>
    Constants.isExplodingModeLocked(state, conversationIDKey)
  )

  const dispatch = Container.useDispatch()

  const unsentTextChanged = React.useCallback(
    (text: string) => {
      dispatch(Chat2Gen.createUnsentTextChanged({conversationIDKey, text: new Container.HiddenString(text)}))
    },
    [dispatch, conversationIDKey]
  )

  const clearUnsentText = React.useCallback(() => {
    dispatch(Chat2Gen.createSetUnsentText({conversationIDKey}))
  }, [conversationIDKey, dispatch])

  const onSetExplodingModeLock = React.useCallback(
    (conversationIDKey: Types.ConversationIDKey, unset: boolean) => {
      dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset}))
    },
    [conversationIDKey]
  )

  const setUnsentText = React.useCallback((text: string) => {
    const set = text.length > 0
    if (isExplodingModeLocked !== set) {
      // if it's locked and we want to unset, unset it
      // alternatively, if it's not locked and we want to set it, set it
      onSetExplodingModeLock(conversationIDKey, !set)
    }
    // The store text only lasts until we change it, so blow it away now
    if (unsentText) {
      clearUnsentText()
    }
    unsentTextMap.set(conversationIDKey, text)
  }, [])

  const sendTypingThrottled = Container.useThrottledCallback(sendTyping, 2000)

  const setText = React.useCallback(
    (text: string, skipUnsentSaving?: boolean) => {
      inputRef.current?.transformText(
        () => ({
          selection: {end: text.length, start: text.length},
          text,
        }),
        true
      )

      if (!skipUnsentSaving) {
        setUnsentText(text)
      }
      sendTypingThrottled(!!text)
    },
    [sendTyping, inputRef]
  )

  const onSubmitAndClear = React.useCallback(
    (text: string) => {
      onSubmit(text)
      setText('')
    },
    [onSubmit, setText]
  )

  const lastTextRef = React.useRef('')
  const unsentTextChangedDebounced = Container.useDebouncedCallback(unsentTextChanged, 500)

  const onChangeText = React.useCallback(
    (text: string) => {
      const skipThrottle = lastTextRef.current.length > 0 && text.length === 0
      setUnsentText(text)
      lastTextRef.current = text

      // If the input bar has been cleared, send typing notification right away
      if (skipThrottle) {
        sendTypingThrottled.cancel()
        sendTyping(false)
      } else {
        sendTypingThrottled(!!text)
      }

      let skipDebounce = text.startsWith('/')

      if (skipDebounce) {
        unsentTextChangedDebounced.cancel()
        unsentTextChanged(text)
      } else {
        unsentTextChangedDebounced(text)
      }
    },
    [setUnsentText, unsentTextChanged]
  )

  const unsentText = Container.useSelector(state => {
    // try the store first
    const text =
      state.chat2.unsentTextMap.get(conversationIDKey)?.stringValue() ?? unsentTextMap.get(conversationIDKey)

    if (text !== undefined) {
      return text
    }

    // fallback on meta draft
    return Constants.getDraft(state, conversationIDKey) ?? ''
  })

  React.useEffect(() => {
    setText(unsentText)
  }, [unsentText])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [focusInputCounter, isActiveForFocus, unsentText])

  const onCancelEditing = React.useCallback(() => {
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
  }, [dispatch, conversationIDKey])

  React.useEffect(() => {
    if (isEditing && isEditExploded) {
      onCancelEditing()
    }
  }, [isEditing, isEditExploded])

  let hintText = ''
  if (Styles.isMobile && isExploding) {
    hintText = isLargeScreen ? `Write an exploding message` : 'Exploding message'
  } else if (cannotWrite) {
    hintText = `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
  } else if (isEditing) {
    hintText = 'Edit your message'
  } else if (isExploding) {
    hintText = 'Write an exploding message'
  } else {
    hintText = inputHintText || 'Write a message'
  }

  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {showReplyPreview && <ReplyPreview conversationIDKey={conversationIDKey} />}
      {
        /*TODO move this into suggestors*/ showCommandMarkdown && (
          <CommandMarkdown conversationIDKey={conversationIDKey} />
        )
      }
      {showCommandStatus && <CommandStatus conversationIDKey={conversationIDKey} />}
      {showGiphySearch && <Giphy conversationIDKey={conversationIDKey} />}
      <PlatformInput
        hintText={hintText}
        maxInputArea={maxInputArea}
        suggestionOverlayStyle={
          infoPanelShowing ? styles.suggestionOverlayInfoShowing : styles.suggestionOverlay
        }
        suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
        onSubmit={onSubmitAndClear}
        inputSetRef={inputRef}
        onChangeText={onChangeText}
        cannotWrite={cannotWrite}
        conversationIDKey={conversationIDKey}
        explodingModeSeconds={explodingModeSeconds}
        isEditing={isEditing}
        isExploding={isExploding}
        minWriterRole={minWriterRole}
        onRequestScrollDown={onRequestScrollDown}
        onRequestScrollUp={onRequestScrollUp}
        showReplyPreview={showReplyPreview}
        showTypingStatus={showTypingStatus}
        showWalletsIcon={showWalletsIcon}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isMobile: {justifyContent: 'flex-end'},
      }),
      suggestionOverlay: Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: 0},
      }),
      suggestionOverlayInfoShowing: Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: infoPanelWidthTablet},
      }),
    } as const)
)

export default Input
