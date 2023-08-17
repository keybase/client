import * as C from '../../../../constants'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import PlatformInput from './platform-input'
import ReplyPreview from '../../reply-preview'
import type * as T from '../../../../constants/types'
import {indefiniteArticle} from '../../../../util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {isLargeScreen} from '../../../../constants/platform'
import * as Platform from '../../../../constants/platform'
import {assertionToDisplay} from '../../../../common-adapters/usernames'

type Props = {
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

const useHintText = (p: {
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: T.Chat.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = C.useCurrentUserState(s => s.username)
  const {teamType, teamname, channelname} = C.useChatContext(s => s.meta)
  const participantInfoName = C.useChatContext(s => s.participants.name)
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
  const {jumpToRecent, focusInputCounter} = p
  const {onRequestScrollDown, onRequestScrollUp, onRequestScrollToBottom} = p

  const showGiphySearch = C.useChatContext(s => s.giphyWindow)
  const showCommandMarkdown = C.useChatContext(s => !!s.commandMarkdown)
  const showCommandStatus = C.useChatContext(s => !!s.commandStatus)
  const showReplyTo = C.useChatContext(s => !!s.messageMap.get(s.replyTo)?.id)
  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {showReplyTo && <ReplyPreview />}
      {/*TODO move this into suggestors*/ showCommandMarkdown && <CommandMarkdown />}
      {showCommandStatus && <CommandStatus />}
      {showGiphySearch && <Giphy />}
      <ConnectedPlatformInput
        jumpToRecent={jumpToRecent}
        focusInputCounter={focusInputCounter}
        onRequestScrollDown={onRequestScrollDown}
        onRequestScrollUp={onRequestScrollUp}
        onRequestScrollToBottom={onRequestScrollToBottom}
      />
    </Kb.Box2>
  )
}

const ConnectedPlatformInput = React.memo(function ConnectedPlatformInput(
  p: Pick<
    Props,
    | 'jumpToRecent'
    | 'focusInputCounter'
    | 'onRequestScrollDown'
    | 'onRequestScrollUp'
    | 'onRequestScrollToBottom'
  >
) {
  const conversationIDKey = C.useChatContext(s => s.id)
  const {focusInputCounter, onRequestScrollToBottom} = p
  const {onRequestScrollDown, onRequestScrollUp, jumpToRecent} = p
  const isTyping = C.useChatContext(s => s.typing.size > 0)
  const infoPanelShowing = C.useChatState(s => s.infoPanelShowing)
  const suggestBotCommandsUpdateStatus = C.useChatContext(s => s.botCommandsUpdateStatus)
  const explodingModeSeconds = C.useChatContext(s => s.getExplodingMode())
  const showGiphySearch = C.useChatContext(s => s.giphyWindow)
  const showCommandMarkdown = C.useChatContext(s => !!s.commandMarkdown)
  const showTypingStatus = isTyping && !showGiphySearch && !showCommandMarkdown
  const {cannotWrite, minWriterRole} = C.useChatContext(s => s.meta)
  const replyTo = C.useChatContext(s => s.messageMap.get(s.replyTo)?.id)
  const editOrdinal = C.useChatContext(s => s.editing)
  const isEditExploded = C.useChatContext(s =>
    editOrdinal ? s.messageMap.get(editOrdinal)?.exploded ?? false : false
  )
  const isEditing = !!editOrdinal
  const unsentText = C.useChatContext(s => s.unsentText)
  const sendTyping = C.useChatContext(s => s.dispatch.sendTyping)
  const resetUnsentText = C.useChatContext(s => s.dispatch.resetUnsentText)
  const updateDraft = C.useChatContext(s => s.dispatch.updateDraft)
  const setExplodingModeLocked = C.useChatContext(s => s.dispatch.setExplodingModeLocked)
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const lastTextRef = React.useRef('')

  // true while injecting since onChangeText is called
  const injectingTextRef = React.useRef(false)
  const onChangeText = React.useCallback(
    (text: string) => {
      if (injectingTextRef.current) return
      lastTextRef.current = text
      sendTyping(text.length > 0)
      updateDraft(text)
      setExplodingModeLocked(text.length > 0)
    },
    [setExplodingModeLocked, sendTyping, updateDraft]
  )
  const injectText = React.useCallback(
    (text: string) => {
      injectingTextRef.current = true
      lastTextRef.current = text
      inputRef.current?.transformText(
        () => ({
          selection: {end: text.length, start: text.length},
          text,
        }),
        true
      )
      injectingTextRef.current = false
    },
    [inputRef]
  )

  const messageSend = C.useChatContext(s => s.dispatch.messageSend)
  const messageEdit = C.useChatContext(s => s.dispatch.messageEdit)
  const onSubmit = React.useCallback(
    (text: string) => {
      if (!text) return

      // non reactive on purpose
      const cs = C.getConvoState(conversationIDKey)
      const editOrdinal = cs.editing
      if (editOrdinal) {
        messageEdit(editOrdinal, text)
      } else {
        messageSend(text, replyTo)
      }

      injectText('')

      const containsLatestMessage = cs.containsLatestMessage
      if (containsLatestMessage) {
        onRequestScrollToBottom()
      } else {
        jumpToRecent()
      }
    },
    [messageEdit, injectText, messageSend, conversationIDKey, onRequestScrollToBottom, jumpToRecent, replyTo]
  )

  Container.useDepChangeEffect(() => {
    inputRef.current?.focus()
  }, [inputRef, focusInputCounter, isEditing])

  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const onCancelEditing = React.useCallback(() => {
    setEditing(false)
    injectText('')
  }, [injectText, setEditing])

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
  const hintText = useHintText({cannotWrite, isEditing, isExploding, minWriterRole})

  // if cid or unsent changes we inject
  const injectRef = React.useRef<string>('')
  React.useEffect(() => {
    // if the convo didn't change we only look at the unsent text being injected
    if (injectRef.current === conversationIDKey) {
      // we want to inject '' sometimes
      if (unsentText !== undefined) {
        injectText(unsentText)
        resetUnsentText()
      }
    } else {
      // look at draft and unsent once
      // not reactive, just once per change
      const draft = C.getConvoState(conversationIDKey).draft
      // prefer injection
      if (unsentText) {
        injectText(unsentText)
        resetUnsentText()
      } else if (draft) {
        injectText(draft)
      } else {
        injectText('')
      }
    }
    injectRef.current = conversationIDKey
  }, [resetUnsentText, conversationIDKey, injectText, unsentText])

  return (
    <PlatformInput
      hintText={hintText}
      suggestionOverlayStyle={
        infoPanelShowing ? styles.suggestionOverlayInfoShowing : styles.suggestionOverlay
      }
      suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      onSubmit={onSubmit}
      inputSetRef={inputRef}
      onChangeText={onChangeText}
      onCancelEditing={onCancelEditing}
      cannotWrite={cannotWrite}
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
