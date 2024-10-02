import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import PlatformInput from './platform-input'
import ReplyPreview from '../../reply-preview'
import * as T from '@/constants/types'
import {indefiniteArticle} from '@/util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {FocusContext, ScrollContext} from '@/chat/conversation/normal/context'
import type {RefType as Input2Ref} from '@/common-adapters/input2'

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
  if (Kb.Styles.isMobile && isExploding) {
    return C.isLargeScreen ? `Write an exploding message` : 'Exploding message'
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
  }
  return 'Write a message'
}

const Input = React.memo(function () {
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
      <ConnectedPlatformInput />
    </Kb.Box2>
  )
})

const ConnectedPlatformInput = React.memo(function ConnectedPlatformInput() {
  // const DEBUG =
  //   C.useChatContext(s => s.id) === '0000b386ba31eebeea5d8ba781aa8ccb4e0c31b6d9a210e74964b42d2d5726c1'
  const infoPanelShowing = C.useChatState(s => s.infoPanelShowing)
  const data = C.useChatContext(
    C.useShallow(s => {
      const {cannotWrite, minWriterRole, tlfname} = s.meta
      const conversationIDKey = s.id
      const editOrdinal = s.editing
      //const explodingModeSeconds = s.getExplodingMode()
      const isEditExploded = editOrdinal ? (s.messageMap.get(editOrdinal)?.exploded ?? false) : false
      const showReplyPreview = !!s.messageMap.get(s.replyTo)?.id
      const suggestBotCommandsUpdateStatus = s.botCommandsUpdateStatus
      const unsentText = s.unsentText
      const isEditing = !!editOrdinal
      const {sendMessage, setEditing, injectIntoInput, jumpToRecent, setExplodingMode} = s.dispatch
      const convoID = s.getConvID()
      const metaGood = s.isMetaGood()
      const storeDraft = metaGood ? s.meta.draft : undefined
      const explodingMode = s.explodingMode
      const convRetention = C.Chat.getEffectiveRetentionPolicy(s.meta)
      const explodingModeSeconds =
        convRetention.type === 'explode'
          ? Math.min(explodingMode || Infinity, convRetention.seconds)
          : explodingMode
      return {
        cannotWrite,
        conversationIDKey,
        convoID,
        editOrdinal,
        explodingMode,
        explodingModeSeconds,
        infoPanelShowing,
        injectIntoInput,
        isEditExploded,
        isEditing,
        jumpToRecent,
        minWriterRole,
        sendMessage,
        setEditing,
        setExplodingMode,
        showReplyPreview,
        storeDraft,
        suggestBotCommandsUpdateStatus,
        tlfname,
        unsentText,
      }
    })
  )

  const {
    cannotWrite,
    conversationIDKey,
    editOrdinal,
    injectIntoInput,
    setExplodingMode: setExplodingModeRaw,
  } = data
  const {isEditExploded, isEditing, jumpToRecent, minWriterRole, sendMessage} = data
  const {explodingModeSeconds: explodingModeSecondsRaw, setEditing, convoID, tlfname, storeDraft} = data
  const {showTypingStatus, suggestBotCommandsUpdateStatus, unsentText, showReplyPreview} = data

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

  const injectText = React.useCallback((text: string, focus?: boolean) => {
    if (!inputRef.current) {
      console.log('injectText injectingTextRef null')
      return
    }
    // injectingTextRef.current = true
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
    if (focus) {
      inputRef.current.focus()
    }
    // injectingTextRef.current = false
  }, [])
  const {scrollToBottom} = React.useContext(ScrollContext)
  const onSubmit = React.useCallback(
    (text: string) => {
      if (!text) return
      injectText('')
      sendMessage(text)
      const cs = C.getConvoState(conversationIDKey)
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
      console.log('aaaa onChangeText  todo >>>>>>>>>>>>>>>>>')
      textValueRef.current = text
      // if (injectingTextRef.current) return
      const isTyping = text.length > 0
      if (!isTyping) {
        sendTyping.cancel()
      }
      sendTyping(isTyping)
      updateDraft(text)
      // lastUnsentText.current = text
      // injectIntoInput(text)
    },
    [sendTyping, updateDraft]
  )

  const onCancelEditing = React.useCallback(() => {
    console.log('aaaa onCancelEditing  todo >>>>>>>>>>>>>>>>>')
    setEditing(false)
    injectText('')
  }, [injectText, setEditing])

  // const [lastIsEditing, setLastIsEditing] = React.useState(isEditing)
  // const [lastIsEditExploded, setLastIsEditExploded] = React.useState(isEditExploded)
  //
  // if (lastIsEditing !== isEditing || lastIsEditExploded !== isEditExploded) {
  //   setLastIsEditing(isEditing)
  //   setLastIsEditExploded(isEditExploded)
  //   if (isEditing && isEditExploded) {
  //     onCancelEditing()
  //   }
  //   if (isEditing) {
  //     inputRef.current?.focus()
  //   }
  // }
  // DEBUG && console.log('bbb aaaa render ==================', conversationIDKey, storeDraft)
  // // TEMP
  // React.useEffect(() => {
  //   DEBUG && console.log('bbb aaaa MOUNTING ==================', conversationIDKey, storeDraft)
  //   return () => {
  //     DEBUG && console.log('bbb aaaa UNMOUNTING ==================', conversationIDKey, storeDraft)
  //   }
  // }, [])

  // on unmount load meta so we have an updated draft
  const loadIDOnUnloadRef = React.useRef(conversationIDKey)
  React.useEffect(() => {
    const rows = [loadIDOnUnloadRef.current]
    return () => {
      C.useChatState.getState().dispatch.unboxRows(rows)
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

  const {setInputRef} = React.useContext(FocusContext)
  React.useEffect(() => {
    setInputRef(inputRef.current)
  }, [setInputRef])

  console.log('aaaa input render>>>>>>>>>>>>', Math.random())

  const allowExplodingModeRef = React.useRef(-1)
  React.useEffect(() => {
    if (explodingModeSeconds !== explodingModeSecondsRaw) {
      // ignore if we have text unless we set it ourselves
      if (!textValueRef.current || allowExplodingModeRef.current === explodingModeSecondsRaw) {
        allowExplodingModeRef.current = -1
        setExplodingModeSeconds(explodingModeSecondsRaw)
      }
    }
  }, [explodingModeSeconds, explodingModeSecondsRaw])

  const setExplodingMode = React.useCallback(
    (mode: number) => {
      allowExplodingModeRef.current = mode
      setExplodingModeRaw(mode, false)
    },
    [setExplodingModeRaw]
  )

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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isMobile: {justifyContent: 'flex-end'},
      }),
      suggestionOverlay: Kb.Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: 0},
      }),
      suggestionOverlayInfoShowing: Kb.Styles.platformStyles({
        isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
        isTablet: {marginLeft: '30%', marginRight: infoPanelWidthTablet},
      }),
    }) as const
)

export default Input
