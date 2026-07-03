import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown'
import CommandStatus from '../../command-status'
import Giphy from '../../giphy'
import * as InputState from '../input-state'
import PlatformInput from './input'
import ReplyPreview from '../../reply-preview'
import * as T from '@/constants/types'
import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {FocusContext, ScrollContext} from '@/chat/conversation/normal/context'
import type {RefType as InputRef} from './input.shared'
import {useConversationCenter, useConversationCenterActions} from '../../center-context'
import {
  useConversationThreadID,
  useConversationThreadMessage,
  useConversationThreadSelector,
  useConversationThreadSetExplodingMode,
  useConversationThreadToggleSearch,
} from '../../thread-context'
import {useConversationParticipants} from '../../data-hooks'
import {useCurrentUserState} from '@/stores/current-user'
import {useRoute} from '@react-navigation/native'
import {metasReceived, unboxRows} from '@/chat/inbox/metadata'

const useHintText = (p: {
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: T.Chat.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = useCurrentUserState(s => s.username)
  const conversationIDKey = useConversationThreadID()
  const {channelname, teamType, teamname} = useConversationThreadSelector(
    C.useShallow(s => ({
      channelname: s.meta.channelname,
      teamType: s.meta.teamType,
      teamname: s.meta.teamname,
    }))
  )
  const participantInfoName = useConversationParticipants(conversationIDKey).name
  if (isMobile && isExploding) {
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
        return `Write in ${isMobile ? '' : `@${teamname}`}#${channelname}`
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

const Input = function Input() {
  const showGiphySearch = InputState.useConversationInput(s => s.giphyWindow)
  const showCommandMarkdown = InputState.useConversationInput(s => !!s.commandMarkdown)
  const showCommandStatus = InputState.useConversationInput(s => !!s.commandStatus)
  const replyTo = InputState.useConversationInput(s => s.replyTo)
  const showReplyTo = !!useConversationThreadMessage(replyTo)?.id
  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {showReplyTo && <ReplyPreview />}
      {/*TODO move this into suggestors*/ showCommandMarkdown && <CommandMarkdown />}
      {showCommandStatus && <CommandStatus />}
      {showGiphySearch && <Giphy />}
      <ConnectedPlatformInput />
    </Kb.Box2>
  )
}

const doInjectText = (inputRef: React.RefObject<InputRef | null>, text: string, focus?: boolean) => {
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
}

const ConnectedPlatformInput = function ConnectedPlatformInput() {
  const route = useRoute()
  // infoPanel only exists on the desktop/tablet split-view chatRoot route
  const infoPanelShowing =
    route.name === 'chatRoot' && 'infoPanel' in route.params && !!route.params.infoPanel
  const uiData = InputState.useConversationInput(
    C.useShallow(s => ({
      editOrdinal: s.editing,
      focusInputCounter: s.focusInputCounter,
      replyTo: s.replyTo,
      unsentText: s.unsentText,
    }))
  )
  const replyToMessage = useConversationThreadMessage(uiData.replyTo)
  const conversationIDKey = useConversationThreadID()
  const {explodingMode, meta} = useConversationThreadSelector(
    C.useShallow(s => ({explodingMode: s.explodingMode, meta: s.meta}))
  )
  const setExplodingModeRaw = useConversationThreadSetExplodingMode()
  const {cannotWrite, minWriterRole, tlfname} = meta
  const convoID = T.Chat.isValidConversationIDKey(conversationIDKey)
    ? T.Chat.keyToConversationID(conversationIDKey)
    : new Uint8Array(0)
  const metaGood = meta.conversationIDKey === conversationIDKey
  const storeDraft = metaGood ? meta.draft : undefined
  const convRetention = Chat.getEffectiveRetentionPolicy(meta)
  const explodingModeSecondsRaw =
    convRetention.type === 'explode' ? Math.min(explodingMode || Infinity, convRetention.seconds) : explodingMode
  const showReplyPreview = !!replyToMessage?.id
  const {editOrdinal, focusInputCounter, unsentText} = uiData
  const isEditing = !!editOrdinal
  const setEditing = InputState.useConversationInputDispatch(s => s.setEditing)
  const updateUnsentText = InputState.useConversationInputDispatch(s => s.injectIntoInput)
  const sendComposerText = InputState.useConversationInputDispatch(s => s.sendComposerText)
  const {hasCenter} = useConversationCenter()
  const {jumpToRecent} = useConversationCenterActions()
  const toggleThreadSearch = useConversationThreadToggleSearch()

  const isExploding = explodingModeSecondsRaw !== 0

  const hintText = useHintText({cannotWrite, isEditing, isExploding, minWriterRole})
  const inputRef = React.useRef<InputRef | null>(null)
  const setLocalInputRef = (r: InputRef | null) => {
    inputRef.current = r
  }
  const suggestionOverlayStyle = infoPanelShowing
    ? styles.suggestionOverlayInfoShowing
    : styles.suggestionOverlay

  const setExplodingMode = (mode: number) => {
    setExplodingModeRaw(mode, false)
  }

  const injectText = (text: string, focus?: boolean) => {
    doInjectText(inputRef, text, focus)
  }

  const {scrollToBottom} = React.useContext(ScrollContext)
  const onSubmit = (text: string) => {
    if (!text) return
    injectText('', true)
    sendComposerText(text)
    if (hasCenter) {
      toggleThreadSearch(true)
      jumpToRecent()
    } else {
      scrollToBottom()
    }
  }

  const sendTypingRaw = (typing: boolean) => {
    const f = async () => {
      await T.RPCChat.localUpdateTypingRpcPromise({conversationID: convoID, typing})
    }
    C.ignorePromise(f())
  }
  const sendTyping = C.useThrottledCallback(sendTypingRaw, 1000)

  const updateDraftRaw = (text: string) => {
    // Immediately update local meta.draft so switching back to this thread
    // before the async unbox completes won't re-inject the old stale draft.
    // Merges from the current meta (same inbox version), so force past gating.
    metasReceived([{...meta, draft: text}], undefined, {force: true})
    const f = async () => {
      await T.RPCChat.localUpdateUnsentTextRpcPromise({
        conversationID: convoID,
        text,
        tlfName: tlfname,
      })
    }
    C.ignorePromise(f())
  }
  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {trailing: true})
  // Flush any pending draft save before cancel fires on unmount (hooks cleanup runs in reverse order)
  React.useLayoutEffect(() => {
    return () => {
      updateDraft.flush()
    }
  }, [updateDraft])

  const textValueRef = React.useRef('')
  const onChangeText = (text: string) => {
    textValueRef.current = text
    const isTyping = text.length > 0
    if (!isTyping) {
      sendTyping.cancel()
    }
    sendTyping(isTyping)
    updateDraft(text)
  }

  const onCancelEditing = () => {
    setEditing('clear')
    injectText('')
  }

  // on unmount load meta so we have an updated draft
  const loadIDOnUnloadRef = React.useRef(conversationIDKey)
  React.useEffect(() => {
    const rows = [loadIDOnUnloadRef.current]
    return () => {
      unboxRows(rows)
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
      doInjectText(inputRef, storeDraft)
    }
  }, [storeDraft])

  const lastFocusInputCounter = React.useRef(focusInputCounter)
  React.useEffect(() => {
    if (unsentText !== undefined) {
      const shouldFocus = focusInputCounter !== lastFocusInputCounter.current
      lastFocusInputCounter.current = focusInputCounter
      doInjectText(inputRef, unsentText, shouldFocus)
      updateUnsentText(undefined)
    }
  }, [focusInputCounter, updateUnsentText, unsentText])

  const {setInputRef} = React.useContext(FocusContext)
  React.useEffect(() => {
    setInputRef(inputRef.current)
  }, [setInputRef])

  return (
    <PlatformInput
      hintText={hintText}
      suggestionOverlayStyle={suggestionOverlayStyle}
      onSubmit={onSubmit}
      setInputRef={setLocalInputRef}
      onChangeText={onChangeText}
      onCancelEditing={onCancelEditing}
      cannotWrite={cannotWrite}
      explodingModeSeconds={explodingModeSecondsRaw}
      isEditing={isEditing}
      isExploding={isExploding}
      minWriterRole={minWriterRole}
      showReplyPreview={showReplyPreview}
      setExplodingMode={setExplodingMode}
    />
  )
}

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
