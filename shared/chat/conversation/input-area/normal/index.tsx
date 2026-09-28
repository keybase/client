import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown'
import CommandStatus from '../../command-status'
import Giphy from '../../giphy'
import * as InputState from '../input-state'
import PlatformInput from './input'
import ReplyPreview from '../../reply-preview'
import UnfurlPreview from '../unfurl-preview'
import * as T from '@/constants/types'
import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {ThreadRefsContext} from '@/chat/conversation/normal/context'
import type {RefType as InputRef} from './input.shared'
import {useComposerInput} from '../composer'
import {useConversationCenter, useConversationCenterActions} from '../../center-context'
import {
  useConversationThreadID,
  useConversationThreadMessage,
  useConversationThreadSelector,
  useConversationThreadSetExplodingMode,
  useConversationThreadToggleSearch,
  useThreadMeta,
} from '../../thread-context'
import {useConversationParticipantsSelector} from '../../data-hooks'
import {useCurrentUserState} from '@/stores/current-user'
import {useRoute} from '@react-navigation/native'
import {metasReceived, unboxRows, useInboxMetadataState} from '@/chat/inbox/metadata'

const useHintText = (p: {
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: T.Chat.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = useCurrentUserState(s => s.username)
  const conversationIDKey = useConversationThreadID()
  const {channelname, teamType, teamname} = useThreadMeta(
    C.useShallow(m => ({
      channelname: m.channelname,
      teamType: m.teamType,
      teamname: m.teamname,
    }))
  )
  const participantInfoName = useConversationParticipantsSelector(conversationIDKey, p => p.name)
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
  const styles = useStyles()
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

const ConnectedPlatformInput = function ConnectedPlatformInput() {
  const styles = useStyles()
  const route = useRoute()
  // infoPanel only exists on the desktop/tablet split-view chatRoot route
  const infoPanelShowing =
    route.name === 'chatRoot' && 'infoPanel' in route.params && !!route.params.infoPanel
  const {editOrdinal, replyTo} = InputState.useConversationInput(
    C.useShallow(s => ({editOrdinal: s.editing, replyTo: s.replyTo}))
  )
  const replyToMessage = useConversationThreadMessage(replyTo)
  const conversationIDKey = useConversationThreadID()
  const explodingMode = useConversationThreadSelector(s => s.explodingMode)
  const meta = useThreadMeta(
    C.useShallow(m => ({
      cannotWrite: m.cannotWrite,
      conversationIDKey: m.conversationIDKey,
      draft: m.draft,
      minWriterRole: m.minWriterRole,
      retentionPolicy: m.retentionPolicy,
      teamRetentionPolicy: m.teamRetentionPolicy,
      tlfname: m.tlfname,
    }))
  )
  const setExplodingModeRaw = useConversationThreadSetExplodingMode()
  const {cannotWrite, minWriterRole, tlfname} = meta
  const convoID = T.Chat.isValidConversationIDKey(conversationIDKey)
    ? T.Chat.keyToConversationID(conversationIDKey)
    : new Uint8Array(0)
  const metaGood = meta.conversationIDKey === conversationIDKey
  const storeDraft = metaGood ? meta.draft : undefined
  const convRetention =
    meta.retentionPolicy.type === 'inherit' ? meta.teamRetentionPolicy : meta.retentionPolicy
  const explodingModeSecondsRaw =
    convRetention.type === 'explode' ? Math.min(explodingMode || Infinity, convRetention.seconds) : explodingMode
  const showReplyPreview = !!replyToMessage?.id
  const isEditing = !!editOrdinal
  const setEditing = InputState.useConversationInputDispatch(s => s.setEditing)
  const sendComposerText = InputState.useConversationInputDispatch(s => s.sendComposerText)
  const {hasCenter} = useConversationCenter()
  const {jumpToRecent} = useConversationCenterActions()
  const toggleThreadSearch = useConversationThreadToggleSearch()

  const isExploding = explodingModeSecondsRaw !== 0

  const hintText = useHintText({cannotWrite, isEditing, isExploding, minWriterRole})
  const {composer, inputRef, setInput, textChanged} = useComposerInput<InputRef>(storeDraft)
  const suggestionOverlayStyle = infoPanelShowing
    ? styles.suggestionOverlayInfoShowing
    : styles.suggestionOverlay

  const setExplodingMode = (mode: number) => {
    setExplodingModeRaw(mode, false)
  }

  const {scrollToBottom} = React.useContext(ThreadRefsContext)
  const onSubmit = () => {
    const sent = composer.submit((text, unfurlSuppress) => {
      sendComposerText(text, unfurlSuppress)
      if (hasCenter) {
        toggleThreadSearch(true)
        jumpToRecent()
      }
    })
    if (sent && !hasCenter) {
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

  // Low-frequency copy of the composer text for the unfurl preview, set from the already
  // throttled draft-save path rather than from onChangeText, so the composer does not
  // re-render on every keystroke. The preview debounces another 500ms downstream anyway.
  const [previewText, setPreviewText] = React.useState('')
  // The account this composer was mounted for. After an account switch the service saves drafts
  // for the next account, so the unmount flush of a draft typed here must not save it there.
  const [composerUid] = React.useState(() => useCurrentUserState.getState().uid)
  const updateDraftRaw = (text: string) => {
    if (useCurrentUserState.getState().uid !== composerUid) {
      return
    }
    // Immediately update local meta.draft so switching back to this thread
    // before the async unbox completes won't re-inject the old stale draft.
    // Merges from the current meta (same inbox version), so force past gating.
    const currentMeta = useInboxMetadataState.getState().metas.get(conversationIDKey)
    if (currentMeta) {
      metasReceived([{...currentMeta, draft: text}], undefined, {force: true})
    }
    setPreviewText(text)
    const f = async () => {
      await T.RPCChat.localUpdateUnsentTextRpcPromise({
        conversationID: convoID,
        text,
        tlfName: tlfname,
      })
    }
    C.ignorePromise(f())
  }
  // flushOnUnmount: leaving the conversation must still save what was typed in the last 200ms
  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {flushOnUnmount: true, trailing: true})

  const onChangeText = (text: string) => {
    textChanged(text)
    const isTyping = text.length > 0
    if (!isTyping) {
      sendTyping.cancel()
    }
    sendTyping(isTyping)
    updateDraft(text)
  }

  const onCancelEditing = () => {
    setEditing('clear')
  }

  // on unmount load meta so we have an updated draft
  const loadIDOnUnloadRef = React.useRef(conversationIDKey)
  React.useEffect(() => {
    const rows = [loadIDOnUnloadRef.current]
    return () => {
      unboxRows(rows)
    }
  }, [loadIDOnUnloadRef])

  const {setInputRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setInputRef(inputRef.current)
  }, [inputRef, setInputRef])

  const input = (
    <PlatformInput
      hintText={hintText}
      suggestionOverlayStyle={suggestionOverlayStyle}
      onSubmit={onSubmit}
      setInputRef={setInput}
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

  // nothing while editing: an edit posts as MessageType_EDIT, which the unfurler does not
  // extract urls from at all, so a card would promise an unfurl the edit cannot produce
  const preview = isEditing ? null : (
    <UnfurlPreview conversationIDKey={conversationIDKey} text={previewText} />
  )

  if (isMobile) {
    // in flow above the composer; it rides KeyboardStickyView with the input
    return (
      <>
        {preview}
        {input}
      </>
    )
  }

  // the preview floats out of this box, so it needs a positioned ancestor
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} relative={true}>
      {preview}
      {input}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => {
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
