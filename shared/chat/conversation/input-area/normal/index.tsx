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
import * as Platform from '../../../../constants/platform'
import {assertionToDisplay} from '../../../../common-adapters/usernames'
import shallowEqual from 'shallowequal'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

const useHintText = (p: {
  conversationIDKey: Types.ConversationIDKey
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: Types.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, conversationIDKey, isExploding, isEditing, cannotWrite} = p
  const {teamType, teamname, channelname, username} = Container.useSelector(state => {
    const teamType = Constants.getMeta(state, conversationIDKey).teamType
    const teamname = Constants.getMeta(state, conversationIDKey).teamname
    const channelname = Constants.getMeta(state, conversationIDKey).channelname
    const username = state.config.username
    return {channelname, teamType, teamname, username}
  }, shallowEqual)
  const participantInfoName = Container.useSelector(
    state => state.chat2.participantMap.get(conversationIDKey)?.name || Constants.noParticipantInfo.name,
    shallowEqual
  )
  if (Styles.isMobile && isExploding) {
    return isLargeScreen ? `Write an exploding message` : 'Exploding message'
  } else if (cannotWrite) {
    return `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
  } else if (isEditing) {
    return 'Edit your message'
  } else if (isExploding) {
    return 'Write an exploding message'
  } else {
    switch (teamType) {
      case 'big':
        if (channelname) {
          return `Write in ${Platform.isMobile ? '' : `@${teamname}`}#${channelname}`
        }
        break
      case 'small':
        if (teamname) {
          return `Write in @${teamname}`
        }
        break
      case 'adhoc':
        if (participantInfoName.length > 2) {
          return 'Message group'
        } else if (participantInfoName.length === 2) {
          const other = participantInfoName.find(n => n !== username)
          if (other) {
            const otherText = other.includes('@') ? assertionToDisplay(other) : `@${other}`
            if (otherText.length < 20) return `Message ${otherText}`
          }
        } else if (participantInfoName.length === 1) {
          return 'Message yourself'
        }
        break
    }
  }
  return 'Write a message'
}

const Input = (p: Props) => {
  const {conversationIDKey, jumpToRecent, focusInputCounter} = p
  const {onRequestScrollDown, onRequestScrollUp, onRequestScrollToBottom} = p

  const {replyTo, showCommandMarkdown, showCommandStatus, showGiphySearch} = Container.useSelector(state => {
    const replyTo = Constants.getReplyToMessageID(state, conversationIDKey) ?? undefined
    const showCommandMarkdown = (state.chat2.commandMarkdownMap.get(conversationIDKey) || '') !== ''
    const showCommandStatus = !!state.chat2.commandStatusMap.get(conversationIDKey)
    const showGiphySearch = state.chat2.giphyWindowMap.get(conversationIDKey) || false
    return {replyTo, showCommandMarkdown, showCommandStatus, showGiphySearch}
  }, shallowEqual)

  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {!!replyTo && <ReplyPreview conversationIDKey={conversationIDKey} />}
      {
        /*TODO move this into suggestors*/ showCommandMarkdown && (
          <CommandMarkdown conversationIDKey={conversationIDKey} />
        )
      }
      {showCommandStatus && <CommandStatus conversationIDKey={conversationIDKey} />}
      {showGiphySearch && <Giphy conversationIDKey={conversationIDKey} />}
      <ConnectedPlatformInput
        conversationIDKey={conversationIDKey}
        jumpToRecent={jumpToRecent}
        focusInputCounter={focusInputCounter}
        onRequestScrollDown={onRequestScrollDown}
        onRequestScrollUp={onRequestScrollUp}
        onRequestScrollToBottom={onRequestScrollToBottom}
        showGiphySearch={showGiphySearch}
        showCommandMarkdown={showCommandMarkdown}
        replyTo={replyTo}
      />
    </Kb.Box2>
  )
}

const unsentTextMap = new Map<Types.ConversationIDKey, string>()
const useUnsentText = (
  conversationIDKey: Types.ConversationIDKey,
  lastTextRef: React.MutableRefObject<string>
) => {
  // only look at the draft once per mount
  const considerDraftRef = React.useRef(true)
  // reset on convo change
  React.useEffect(() => {
    considerDraftRef.current = true
  }, [conversationIDKey])
  const {draft, storeUnsentText} = Container.useSelector(state => {
    const draft = considerDraftRef.current ? Constants.getDraft(state, conversationIDKey) : undefined
    // we use the hiddenstring since external actions can try and affect the input state (especially clearing it) and that can fail if it doesn't change
    const storeUnsentText = state.chat2.unsentTextMap.get(conversationIDKey)
    return {draft, storeUnsentText}
  }, shallowEqual)
  const prevDraft = Container.usePrevious(draft)
  const prevStoreUnsentText = Container.usePrevious(storeUnsentText)

  let unsentText: string | undefined = undefined
  // use draft if changed , or store if changed, or the module map
  if (considerDraftRef.current && draft && draft !== prevDraft && draft !== lastTextRef.current) {
    unsentText = draft
  } else if (
    storeUnsentText &&
    prevStoreUnsentText !== storeUnsentText &&
    storeUnsentText.stringValue() !== lastTextRef.current
  ) {
    unsentText = storeUnsentText.stringValue()
  }

  //one chance to use the draft
  considerDraftRef.current = false

  const dispatch = Container.useDispatch()
  const onSetExplodingModeLock = React.useCallback(
    (locked: boolean) => {
      dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset: !locked}))
    },
    [dispatch, conversationIDKey]
  )
  const clearUnsentText = React.useCallback(() => {
    dispatch(Chat2Gen.createSetUnsentText({conversationIDKey}))
  }, [conversationIDKey, dispatch])

  const setUnsentText = React.useCallback(
    (text: string) => {
      // this should be from the store but its entirely driven by this component only so we make an implicit assumption here so we avoid redux changes
      const isExplodingModeLocked = (unsentTextMap.get(conversationIDKey)?.length ?? 0) > 0
      const shouldLock = text.length > 0
      if (isExplodingModeLocked !== shouldLock) {
        // if it's locked and we want to unset, unset it
        // alternatively, if it's not locked and we want to set it, set it
        onSetExplodingModeLock(shouldLock)
      }
      // The store text only lasts until we change it, so blow it away now
      if (unsentText) {
        clearUnsentText()
      }
      unsentTextMap.set(conversationIDKey, text)
    },
    [unsentText, clearUnsentText, conversationIDKey, onSetExplodingModeLock]
  )
  const unsentTextChanged = React.useCallback(
    (text: string) => {
      dispatch(Chat2Gen.createUnsentTextChanged({conversationIDKey, text: new Container.HiddenString(text)}))
    },
    [dispatch, conversationIDKey]
  )

  const unsentTextChangedThrottled = Container.useThrottledCallback(unsentTextChanged, 500)

  return {setUnsentText, unsentText, unsentTextChanged, unsentTextChangedThrottled}
}

const useInput = () => {
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const setTextInput = React.useCallback(
    (text: string) => {
      inputRef.current?.transformText(
        () => ({
          selection: {end: text.length, start: text.length},
          text,
        }),
        true
      )
    },
    [inputRef]
  )

  return {inputRef, setTextInput}
}

const useSubmit = (
  p: Pick<Props, 'conversationIDKey' | 'jumpToRecent' | 'onRequestScrollToBottom'> & {
    editOrdinal: Types.Ordinal | undefined
    replyTo: Types.Ordinal | undefined
  }
) => {
  const {conversationIDKey, onRequestScrollToBottom, jumpToRecent, editOrdinal, replyTo} = p
  const dispatch = Container.useDispatch()
  const containsLatestMessage = Container.useSelector(
    state => state.chat2.containsLatestMessageMap.get(conversationIDKey) || false
  )
  const onPostMessage = React.useCallback(
    (text: string) => {
      dispatch(
        Chat2Gen.createMessageSend({
          conversationIDKey,
          replyTo: replyTo || undefined,
          text: new Container.HiddenString(text),
        })
      )
    },
    [dispatch, conversationIDKey, replyTo]
  )
  const onEditMessage = React.useCallback(
    (body: string) => {
      if (editOrdinal !== undefined) {
        dispatch(
          Chat2Gen.createMessageEdit({
            conversationIDKey,
            ordinal: editOrdinal,
            text: new Container.HiddenString(body),
          })
        )
      }
    },
    [dispatch, conversationIDKey, editOrdinal]
  )
  const onSubmit = Container.useEvent((text: string) => {
    // don't submit empty
    if (!text) {
      return
    }
    if (editOrdinal) {
      onEditMessage(text)
    } else {
      onPostMessage(text)
    }
    if (containsLatestMessage) {
      onRequestScrollToBottom()
    } else {
      jumpToRecent()
    }
  })

  return {onSubmit}
}

const useTyping = (conversationIDKey: Types.ConversationIDKey) => {
  const dispatch = Container.useDispatch()
  const sendTyping = React.useCallback(
    (typing: boolean) => {
      dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing}))
    },
    [dispatch, conversationIDKey]
  )
  const sendTypingThrottled = Container.useThrottledCallback(sendTyping, 2000)
  return {sendTyping, sendTypingThrottled}
}

const ConnectedPlatformInput = React.memo(function ConnectedPlatformInput(
  p: Pick<
    Props,
    | 'conversationIDKey'
    | 'jumpToRecent'
    | 'focusInputCounter'
    | 'onRequestScrollDown'
    | 'onRequestScrollUp'
    | 'onRequestScrollToBottom'
  > & {showGiphySearch: boolean; showCommandMarkdown: boolean; replyTo: Types.Ordinal | undefined}
) {
  const {conversationIDKey, focusInputCounter, showCommandMarkdown, onRequestScrollToBottom} = p
  const {onRequestScrollDown, onRequestScrollUp, showGiphySearch, replyTo, jumpToRecent} = p
  const dispatch = Container.useDispatch()
  const {editOrdinal, isEditExploded} = Container.useSelector(state => {
    const editOrdinal = state.chat2.editingMap.get(conversationIDKey)
    const isEditExploded = editOrdinal
      ? Constants.getMessage(state, conversationIDKey, editOrdinal)?.exploded ?? false
      : false
    return {editOrdinal, isEditExploded}
  }, shallowEqual)
  const isEditing = !!editOrdinal
  const {onSubmit} = useSubmit({
    conversationIDKey,
    editOrdinal,
    jumpToRecent,
    onRequestScrollToBottom,
    replyTo,
  })
  const {sendTyping, sendTypingThrottled} = useTyping(conversationIDKey)
  const {inputRef, setTextInput} = useInput()
  const lastTextRef = React.useRef('')
  const {unsentText, unsentTextChanged, unsentTextChangedThrottled, setUnsentText} = useUnsentText(
    conversationIDKey,
    lastTextRef
  )

  const setText = React.useCallback(
    (text: string) => {
      setTextInput(text)
      setUnsentText(text)
      sendTypingThrottled(!!text)
    },
    [sendTypingThrottled, setUnsentText, setTextInput]
  )

  const onSubmitAndClear = React.useCallback(
    (text: string) => {
      onSubmit(text)
      setText('')
    },
    [onSubmit, setText]
  )

  const onChangeText = React.useCallback(
    (text: string) => {
      lastTextRef.current = text
      const skipThrottle = lastTextRef.current.length > 0 && text.length === 0
      setUnsentText(text)

      // If the input bar has been cleared, send typing notification right away
      if (skipThrottle) {
        sendTypingThrottled.cancel()
        sendTyping(false)
      } else {
        sendTypingThrottled(!!text)
      }

      const skipDebounce = text.startsWith('/')

      if (skipDebounce) {
        unsentTextChangedThrottled.cancel()
        unsentTextChanged(text)
      } else {
        unsentTextChangedThrottled(text)
      }
    },
    [sendTyping, sendTypingThrottled, setUnsentText, unsentTextChanged, unsentTextChangedThrottled]
  )

  React.useEffect(() => {
    if (unsentText !== undefined) {
      lastTextRef.current = unsentText
      setTextInput(unsentText)
    }
  }, [unsentText, setTextInput])

  const data = Container.useSelector(state => {
    const isActiveForFocus = state.chat2.focus === null
    const showTypingStatus =
      Constants.getTyping(state, conversationIDKey).size !== 0 && !showGiphySearch && !showCommandMarkdown
    const showWalletsIcon = Constants.shouldShowWalletsIcon(state, conversationIDKey)
    const explodingModeSeconds = Constants.getConversationExplodingMode(state, conversationIDKey)
    const cannotWrite = Constants.getMeta(state, conversationIDKey).cannotWrite
    const minWriterRole = Constants.getMeta(state, conversationIDKey).minWriterRole
    const infoPanelShowing = state.chat2.infoPanelShowing
    const suggestBotCommandsUpdateStatus =
      state.chat2.botCommandsUpdateStatusMap.get(conversationIDKey) ||
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank
    return {
      cannotWrite,
      explodingModeSeconds,
      infoPanelShowing,
      isActiveForFocus,
      minWriterRole,
      showTypingStatus,
      showWalletsIcon,
      suggestBotCommandsUpdateStatus,
    }
  }, shallowEqual)
  const {cannotWrite, explodingModeSeconds, infoPanelShowing, isActiveForFocus} = data
  const {minWriterRole, showTypingStatus, showWalletsIcon, suggestBotCommandsUpdateStatus} = data

  Container.useDepChangeEffect(() => {
    inputRef.current?.focus()
  }, [inputRef, focusInputCounter, isActiveForFocus, isEditing])

  const onCancelEditing = React.useCallback(() => {
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
    setText('')
  }, [dispatch, conversationIDKey, setText])

  React.useEffect(() => {
    if (isEditing && isEditExploded) {
      onCancelEditing()
    }
  }, [isEditing, isEditExploded, onCancelEditing])

  const isExploding = explodingModeSeconds !== 0
  const hintText = useHintText({cannotWrite, conversationIDKey, isEditing, isExploding, minWriterRole})

  return (
    <PlatformInput
      hintText={hintText}
      suggestionOverlayStyle={
        infoPanelShowing ? styles.suggestionOverlayInfoShowing : styles.suggestionOverlay
      }
      suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      onSubmit={onSubmitAndClear}
      inputSetRef={inputRef}
      onChangeText={onChangeText}
      onCancelEditing={onCancelEditing}
      cannotWrite={cannotWrite}
      conversationIDKey={conversationIDKey}
      explodingModeSeconds={explodingModeSeconds}
      isEditing={isEditing}
      isExploding={isExploding}
      minWriterRole={minWriterRole}
      onRequestScrollDown={onRequestScrollDown}
      onRequestScrollUp={onRequestScrollUp}
      showReplyPreview={!!replyTo}
      showTypingStatus={showTypingStatus}
      showWalletsIcon={showWalletsIcon}
    />
  )
})

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
