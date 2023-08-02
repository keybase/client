import * as Constants from '../../../../constants/chat2'
import * as ConfigConstants from '../../../../constants/config'
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
import * as Platform from '../../../../constants/platform'
import {assertionToDisplay} from '../../../../common-adapters/usernames'

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
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const {teamType, teamname, channelname} = Constants.useContext(s => s.meta)
  const participantInfoName = Constants.useContext(s => s.participants.name)
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

  const showGiphySearch = Constants.useContext(s => s.giphyWindow)
  const rorindal = Constants.useContext(s => s.replyTo)
  const showCommandMarkdown = Constants.useContext(s => !!s.commandMarkdown)
  const showCommandStatus = Constants.useContext(s => !!s.commandStatus)
  const replyTo = Container.useSelector(
    state => Constants.getReplyToMessageID(rorindal, state, conversationIDKey) ?? undefined
  )

  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {!!replyTo && <ReplyPreview conversationIDKey={conversationIDKey} />}
      {/*TODO move this into suggestors*/ showCommandMarkdown && <CommandMarkdown />}
      {showCommandStatus && <CommandStatus />}
      {showGiphySearch && <Giphy />}
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
// TODO this hook is a little tricky. We keep drafts in the store. We only inject drafts on first mount.
// We also keep unsentText in the store, which allows other things to programmatically inject text (including '')
// So we have a hierarchy of things from the store. After an unsentText is injected it serves no purpose in the store
// so its set to undefined. The render function also keeps track of what comes out of this hook to see if there is a diff
// and actually injects into the ref input. Might be simpler to set a dynamic setter in zustand to directly set the value
// in the input
const useUnsentText = (
  conversationIDKey: Types.ConversationIDKey,
  _lastTextRef: React.MutableRefObject<string>
) => {
  // only look at the draft once per mount
  const considerDraftRef = React.useRef(true)
  const draft = Constants.useContext(s => s.draft)
  const storeUnsentText = Constants.useContext(s => s.unsentText)
  const prevDraft = React.useRef<string | undefined>(undefined)
  const prevStoreUnsentText = React.useRef<string | undefined>(undefined)

  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  // reset on convo change
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    considerDraftRef.current = true
    prevDraft.current = undefined
    prevStoreUnsentText.current = undefined
  }

  let unsentText: string | undefined = undefined
  // use draft if changed , or store if changed, or the module map
  if (considerDraftRef.current && draft && draft !== prevDraft.current) {
    unsentText = draft
  } else if (prevStoreUnsentText.current !== storeUnsentText) {
    unsentText = storeUnsentText
  }

  //one chance to use the draft
  considerDraftRef.current = false
  prevDraft.current = draft
  prevStoreUnsentText.current = storeUnsentText

  const dispatch = Container.useDispatch()
  const onSetExplodingModeLocked = Constants.useContext(s => s.dispatch.setExplodingModeLocked)

  const resetUnsentText = Constants.useContext(s => s.dispatch.resetUnsentText)

  const setUnsentText = React.useCallback(
    (text: string) => {
      // this should be from the store but its entirely driven by this component only so we make an implicit assumption here so we avoid redux changes
      const isExplodingModeLocked = (unsentTextMap.get(conversationIDKey)?.length ?? 0) > 0
      const shouldLock = text.length > 0
      if (isExplodingModeLocked !== shouldLock) {
        // if it's locked and we want to unset, unset it
        // alternatively, if it's not locked and we want to set it, set it
        onSetExplodingModeLocked(shouldLock)
      }
      // The store text only lasts until we change it, so blow it away now
      if (storeUnsentText !== undefined) {
        resetUnsentText()
      }
      unsentTextMap.set(conversationIDKey, text)
    },
    [storeUnsentText, resetUnsentText, conversationIDKey, onSetExplodingModeLocked]
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
  const containsLatestMessage = Constants.useContext(s => s.containsLatestMessage)
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
  const editOrdinal = Constants.useContext(s => s.editing)
  const isEditExploded = Constants.useContext(s =>
    editOrdinal ? s.messageMap.get(editOrdinal)?.exploded ?? false : false
  )
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

  const [lastUnsentText, setLastUnsentText] = React.useState<string | undefined>()
  if (lastUnsentText !== unsentText) {
    setLastUnsentText(unsentText)
    if (unsentText !== undefined) {
      lastTextRef.current = unsentText
      setTextInput(lastTextRef.current)
    }
  }
  // needs to be an effect since setTextInput needs a mounted ref
  React.useEffect(() => {
    setTextInput(lastTextRef.current)
  }, [setTextInput])

  const isTyping = Constants.useContext(s => s.typing.size > 0)
  const infoPanelShowing = Constants.useState(s => s.infoPanelShowing)
  const suggestBotCommandsUpdateStatus = Constants.useContext(s => s.botCommandsUpdateStatus)
  const explodingModeSeconds = Constants.useContext(s => s.getExplodingMode())
  const showTypingStatus = isTyping && !showGiphySearch && !showCommandMarkdown
  const {cannotWrite, minWriterRole} = Constants.useContext(s => s.meta)

  Container.useDepChangeEffect(() => {
    inputRef.current?.focus()
  }, [inputRef, focusInputCounter, isEditing])

  const setEditing = Constants.useContext(s => s.dispatch.setEditing)
  const onCancelEditing = React.useCallback(() => {
    setEditing(false)
    setText('')
  }, [setEditing, setText])

  const [lastIsEditing, setLastIsEditing] = React.useState(isEditing)
  const [lastIsEditExploded, setLastIsEditExploded] = React.useState(isEditExploded)

  if (lastIsEditing !== isEditing || lastIsEditExploded !== isEditExploded) {
    setLastIsEditing(isEditing)
    setLastIsEditExploded(isEditExploded)
    if (isEditing && isEditExploded) {
      onCancelEditing()
    }
  }

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
    }) as const
)

export default Input
