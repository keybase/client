import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown'
import CommandStatus from '../../command-status'
import Giphy from '../../giphy'
import PlatformInput from './platform-input'
import ReplyPreview from '../../reply-preview'
import * as T from '@/constants/types'
import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {FocusContext, ScrollContext} from '@/chat/conversation/normal/context'
import type {RefType as Input2Ref} from '@/common-adapters/input2'
import {useCurrentUserState} from '@/stores/current-user'

const useHintText = (p: {
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: T.Chat.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = useCurrentUserState(s => s.username)
  const {teamType, teamname, channelname} = Chat.useChatContext(s => s.meta)
  const participantInfoName = Chat.useChatContext(s => s.participants.name)
  if (Kb.Styles.isMobile && isExploding) {
    return C.isLargeScreen ? `Write an exploding message` : 'Exploding message'
  }
  if (cannotWrite) {
    return `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
  }
  if (isEditing) {
    return 'Edit your message'
  }
  if (isExploding) {
    return 'Write an exploding message'
  }

  switch (teamType) {
    case 'big':
      if (channelname) {
        return `Write in ${C.isMobile ? '' : `@${teamname}`}#${channelname}`
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
  return 'Write a message'
}

const Input = React.memo(function Input() {
  const showGiphySearch = Chat.useChatContext(s => s.giphyWindow)
  const showCommandMarkdown = Chat.useChatContext(s => !!s.commandMarkdown)
  const showCommandStatus = Chat.useChatContext(s => !!s.commandStatus)
  const showReplyTo = Chat.useChatContext(s => !!s.messageMap.get(s.replyTo)?.id)
  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {showReplyTo && <ReplyPreview />}
      {/*TODO move this into suggestors*/ showCommandMarkdown && <CommandMarkdown />}
      {showCommandStatus && <CommandStatus />}
      {showGiphySearch && <Giphy />}
      <ConnectedPlatformInput />
    </Kb.Box2>
  )
})

const ConnectedPlatformInput = React.memo(function ConnectedPlatformInput() {
  const infoPanelShowing = Chat.useChatState(s => s.infoPanelShowing)
  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {meta, id: conversationIDKey, editing: editOrdinal, messageMap, unsentText} = s
      const {sendMessage, setEditing, jumpToRecent, setExplodingMode} = s.dispatch
      const {injectIntoInput: updateUnsentText} = s.dispatch
      const {cannotWrite, minWriterRole, tlfname} = meta
      const showReplyPreview = !!messageMap.get(s.replyTo)?.id
      const suggestBotCommandsUpdateStatus = s.botCommandsUpdateStatus
      const isEditing = !!editOrdinal
      const convoID = s.getConvID()
      const metaGood = s.isMetaGood()
      const storeDraft = metaGood ? meta.draft : undefined
      const explodingMode = s.explodingMode
      const convRetention = Chat.getEffectiveRetentionPolicy(meta)
      const explodingModeSeconds =
        convRetention.type === 'explode'
          ? Math.min(explodingMode || Infinity, convRetention.seconds)
          : explodingMode
      // prettier-ignore
      return {cannotWrite, conversationIDKey, convoID, explodingMode, explodingModeSeconds,
        infoPanelShowing, isEditing, jumpToRecent, minWriterRole, sendMessage, setEditing,
        setExplodingMode, showReplyPreview, storeDraft, suggestBotCommandsUpdateStatus,
        tlfname, unsentText, updateUnsentText}
    })
  )

  const {cannotWrite, conversationIDKey, setExplodingMode: setExplodingModeRaw} = data
  const {isEditing, jumpToRecent, minWriterRole, sendMessage} = data
  const {explodingModeSeconds: explodingModeSecondsRaw, setEditing, convoID, tlfname, storeDraft} = data
  const {suggestBotCommandsUpdateStatus, unsentText, showReplyPreview, updateUnsentText} = data

  const [explodingModeSeconds, setExplodingModeSeconds] = React.useState(explodingModeSecondsRaw)
  const isExploding = explodingModeSeconds !== 0

  const hintText = useHintText({cannotWrite, isEditing, isExploding, minWriterRole})
  const inputRef = React.useRef<Input2Ref | null>(null)
  const setInput2Ref = React.useCallback((r: Input2Ref | null) => {
    inputRef.current = r
  }, [])
  const suggestionOverlayStyle = infoPanelShowing
    ? styles.suggestionOverlayInfoShowing
    : styles.suggestionOverlay

  const allowExplodingModeRef = React.useRef(-1)
  const setExplodingMode = React.useCallback(
    (mode: number) => {
      allowExplodingModeRef.current = mode
      setExplodingModeRaw(mode, false)
    },
    [setExplodingModeRaw]
  )

  const injectText = React.useCallback((text: string, focus?: boolean) => {
    if (!inputRef.current) {
      console.log('injectText injectingTextRef null')
      return
    }
    if (!text) {
      inputRef.current.clear()
    } else {
      inputRef.current.transformText(
        () => ({
          selection:
            text === '!>spoiler<!'
              ? {end: text.length - 2, start: text.length - 2 - 7}
              : {end: text.length, start: text.length},
          text,
        }),
        true
      )
    }
    if (focus) {
      inputRef.current.focus()
    }
  }, [])

  const {scrollToBottom} = React.useContext(ScrollContext)
  const onSubmit = React.useCallback(
    (text: string) => {
      if (!text) return
      injectText('', true)
      sendMessage(text)
      const cs = Chat.getConvoState(conversationIDKey)
      if (cs.messageCenterOrdinal) {
        cs.dispatch.toggleThreadSearch(true)
        jumpToRecent()
      } else {
        scrollToBottom()
      }
    },
    [injectText, sendMessage, jumpToRecent, scrollToBottom, conversationIDKey]
  )

  const sendTypingRaw = React.useCallback(
    (typing: boolean) => {
      const f = async () => {
        await T.RPCChat.localUpdateTypingRpcPromise({conversationID: convoID, typing})
      }
      C.ignorePromise(f())
    },
    [convoID]
  )
  const sendTyping = C.useThrottledCallback(sendTypingRaw, 1000)

  const updateDraftRaw = React.useCallback(
    (text: string) => {
      const f = async () => {
        await T.RPCChat.localUpdateUnsentTextRpcPromise({
          conversationID: convoID,
          text,
          tlfName: tlfname,
        })
      }
      C.ignorePromise(f())
    },
    [convoID, tlfname]
  )
  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {trailing: true})

  const textValueRef = React.useRef('')
  const onChangeText = React.useCallback(
    (text: string) => {
      textValueRef.current = text
      const isTyping = text.length > 0
      if (!isTyping) {
        sendTyping.cancel()
      }
      sendTyping(isTyping)
      updateDraft(text)
    },
    [sendTyping, updateDraft]
  )

  const onCancelEditing = React.useCallback(() => {
    setEditing('clear')
    injectText('')
  }, [injectText, setEditing])

  // on unmount load meta so we have an updated draft
  const loadIDOnUnloadRef = React.useRef(conversationIDKey)
  React.useEffect(() => {
    const rows = [loadIDOnUnloadRef.current]
    return () => {
      Chat.useChatState.getState().dispatch.unboxRows(rows)
    }
  }, [loadIDOnUnloadRef])

  // maybe inject a draft
  const loadedDraft = React.useRef(false)
  React.useEffect(() => {
    if (loadedDraft.current) {
      return
    }
    // not loaded yet
    if (storeDraft === undefined) {
      return
    }
    loadedDraft.current = true
    if (textValueRef.current === '' && storeDraft) {
      injectText(storeDraft)
    }
  }, [injectText, storeDraft])

  React.useEffect(() => {
    if (unsentText !== undefined) {
      injectText(unsentText)
      updateUnsentText(undefined)
    }
  }, [updateUnsentText, unsentText, injectText])

  const {setInputRef} = React.useContext(FocusContext)
  React.useEffect(() => {
    setInputRef(inputRef.current)
  }, [setInputRef])

  React.useEffect(() => {
    if (explodingModeSeconds !== explodingModeSecondsRaw) {
      // ignore if we have text unless we set it ourselves
      if (!textValueRef.current || allowExplodingModeRef.current === explodingModeSecondsRaw) {
        allowExplodingModeRef.current = -1
        setExplodingModeSeconds(explodingModeSecondsRaw)
      }
    }
  }, [explodingModeSeconds, explodingModeSecondsRaw])

  return (
    <PlatformInput
      hintText={hintText}
      suggestionOverlayStyle={suggestionOverlayStyle}
      suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      onSubmit={onSubmit}
      setInput2Ref={setInput2Ref}
      onChangeText={onChangeText}
      onCancelEditing={onCancelEditing}
      cannotWrite={cannotWrite}
      explodingModeSeconds={explodingModeSeconds}
      isEditing={isEditing}
      isExploding={isExploding}
      minWriterRole={minWriterRole}
      showReplyPreview={showReplyPreview}
      setExplodingMode={setExplodingMode}
    />
  )
})

const styles = Kb.Styles.styleSheetCreate(() => {
  const suggestDesktop = {marginLeft: 15, marginRight: 15, marginTop: 'auto'}
  return {
    container: Kb.Styles.platformStyles({
      isMobile: {justifyContent: 'flex-end'},
    }),
    suggestionOverlay: Kb.Styles.platformStyles({
      isElectron: suggestDesktop,
      isTablet: {marginLeft: '30%', marginRight: 0},
    }),
    suggestionOverlayInfoShowing: Kb.Styles.platformStyles({
      isElectron: suggestDesktop,
      isTablet: {marginLeft: '30%', marginRight: infoPanelWidthTablet},
    }),
  } as const
})

export default Input
