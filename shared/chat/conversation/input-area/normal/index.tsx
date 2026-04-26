import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown'
import CommandStatus from '../../command-status'
import Giphy from '../../giphy'
import PlatformInput from './input'
import ReplyPreview from '../../reply-preview'
import * as T from '@/constants/types'
import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {FocusContext, ScrollContext} from '@/chat/conversation/normal/context'
import type {RefType as InputRef} from './input'
import {useCurrentUserState} from '@/stores/current-user'
import {useRoute} from '@react-navigation/native'
import {getRouteParamsFromRoute, type RootRouteProps} from '@/router-v2/route-params'

const useHintText = (p: {
  isExploding: boolean
  isEditing: boolean
  cannotWrite: boolean
  minWriterRole: T.Chat.ConversationMeta['minWriterRole']
}) => {
  const {minWriterRole, isExploding, isEditing, cannotWrite} = p
  const username = useCurrentUserState(s => s.username)
  const {teamType, teamname, channelname} = ConvoState.useChatContext(s => s.meta)
  const participantInfoName = ConvoState.useChatContext(s => s.participants.name)
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

const Input = function Input() {
  const showGiphySearch = ConvoState.useChatUIContext(s => s.giphyWindow)
  const showCommandMarkdown = ConvoState.useChatContext(s => !!s.commandMarkdown)
  const showCommandStatus = ConvoState.useChatUIContext(s => !!s.commandStatus)
  const replyTo = ConvoState.useChatUIContext(s => s.replyTo)
  const showReplyTo = ConvoState.useChatContext(s => !!s.messageMap.get(replyTo)?.id)
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
  const route = useRoute<RootRouteProps<'chatConversation'> | RootRouteProps<'chatRoot'>>()
  const params = getRouteParamsFromRoute<'chatConversation' | 'chatRoot'>(route)
  const infoPanelShowing = !!(params && typeof params === 'object' && 'infoPanel' in params && params.infoPanel)
  const uiData = ConvoState.useChatUIContext(
    C.useShallow(s => ({
      editOrdinal: s.editing,
      replyTo: s.replyTo,
      unsentText: s.unsentText,
    }))
  )
  const data = ConvoState.useChatContext(
    C.useShallow(s => {
      const {meta, id: conversationIDKey, messageMap} = s
      const {sendMessage, jumpToRecent, setExplodingMode} = s.dispatch
      const {cannotWrite, minWriterRole, tlfname} = meta
      const showReplyPreview = !!messageMap.get(uiData.replyTo)?.id
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
        jumpToRecent, minWriterRole, sendMessage, setExplodingMode, showReplyPreview,
        storeDraft, tlfname}
    })
  )

  const {cannotWrite, conversationIDKey, setExplodingMode: setExplodingModeRaw} = data
  const {jumpToRecent, minWriterRole, sendMessage} = data
  const {explodingModeSeconds: explodingModeSecondsRaw, convoID, tlfname, storeDraft} = data
  const {showReplyPreview} = data
  const {editOrdinal, unsentText} = uiData
  const isEditing = !!editOrdinal
  const setEditing = ConvoState.useChatUIContext(s => s.dispatch.setEditing)
  const updateUnsentText = ConvoState.useChatUIContext(s => s.dispatch.injectIntoInput)

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
    sendMessage(text)
    const cs = ConvoState.getConvoState(conversationIDKey)
    if (cs.messageCenterOrdinal) {
      cs.dispatch.toggleThreadSearch(true)
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
      ConvoState.unboxRows(rows)
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

  React.useEffect(() => {
    if (unsentText !== undefined) {
      doInjectText(inputRef, unsentText)
      updateUnsentText(undefined)
    }
  }, [updateUnsentText, unsentText])

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
