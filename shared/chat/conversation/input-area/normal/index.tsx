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
  const {jumpToRecent, focusInputCounter} = p
  const {onRequestScrollDown, onRequestScrollUp, onRequestScrollToBottom} = p

  const showGiphySearch = Constants.useContext(s => s.giphyWindow)
  const showCommandMarkdown = Constants.useContext(s => !!s.commandMarkdown)
  const showCommandStatus = Constants.useContext(s => !!s.commandStatus)
  const showReplyTo = Constants.useContext(s => !!s.messageMap.get(s.replyTo)?.id)

  const NOJIMA = Constants.useContext(s => s.commandMarkdown)
  console.log('aaaa', NOJIMA)
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
  const conversationIDKey = Constants.useContext(s => s.id)
  const {focusInputCounter, onRequestScrollToBottom} = p
  const {onRequestScrollDown, onRequestScrollUp, jumpToRecent} = p
  const showGiphySearch = Constants.useContext(s => s.giphyWindow)
  const showCommandMarkdown = Constants.useContext(s => !!s.commandMarkdown)
  const replyTo = Constants.useContext(s => s.messageMap.get(s.replyTo)?.id)
  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  const editOrdinal = Constants.useContext(s => s.editing)
  const isEditExploded = Constants.useContext(s =>
    editOrdinal ? s.messageMap.get(editOrdinal)?.exploded ?? false : false
  )
  const isEditing = !!editOrdinal
  const dispatch = Container.useDispatch()
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const lastTextRef = React.useRef('')

  const draft = Constants.useContext(s => s.draft)
  const unsentText = Constants.useContext(s => s.unsentText)
  const resetUnsentText = Constants.useContext(s => s.dispatch.resetUnsentText)
  const setExplodingModeLocked = Constants.useContext(s => s.dispatch.setExplodingModeLocked)
  console.log('aaaa render', {conversationIDKey, draft, unsentText})
  const [lastDraft, setLastDraft] = React.useState<undefined | string>()

  const sendTyping = React.useCallback(
    (text: string) => {
      // TODO throttle?
      dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing: text.length > 0}))
    },
    [dispatch, conversationIDKey]
  )

  const sendDraft = React.useCallback(
    (text: string) => {
      // TODO throttle?
      dispatch(Chat2Gen.createUnsentTextChanged({conversationIDKey, text: new Container.HiddenString(text)}))
    },
    [dispatch, conversationIDKey]
  )

  // true while injecting since onChaggeText is called
  const injectingTextRef = React.useRef(false)
  const onChangeText = React.useCallback(
    (text: string) => {
      if (injectingTextRef.current) return
      console.log('aaaa onChangeText', text)
      lastTextRef.current = text
      sendTyping(text)
      sendDraft(text)
      setExplodingModeLocked(text.length > 0)
    },
    [setExplodingModeLocked, sendTyping, sendDraft]
  )
  const injectText = React.useCallback(
    (text: string) => {
      console.log('aaaa injectText', text, inputRef.current ? 'good ref' : 'BAD ref')
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
      console.log('aaaa injectText after', text)
    },
    [inputRef]
  )

  // const setInputCallback = Constants.useContext(s => s.dispatch.setInputCallback)
  // React.useEffect(() => {
  //   setInputCallback(injectText)
  // }, [setInputCallback, injectText])

  const onSubmit = React.useCallback(
    (text: string) => {
      if (!text) return

      // non reactive on purpose
      const cs = Constants.getConvoState(conversationIDKey)
      const editOrdinal = cs.editing
      if (editOrdinal) {
        dispatch(
          Chat2Gen.createMessageSend({
            conversationIDKey,
            replyTo,
            text: new Container.HiddenString(text),
          })
        )
      } else {
        dispatch(
          Chat2Gen.createMessageSend({
            conversationIDKey,
            replyTo,
            text: new Container.HiddenString(text),
          })
        )
      }

      injectText('')

      const containsLatestMessage = cs.containsLatestMessage
      if (containsLatestMessage) {
        onRequestScrollToBottom()
      } else {
        jumpToRecent()
      }
    },
    [injectText, dispatch, conversationIDKey, onRequestScrollToBottom, jumpToRecent, replyTo]
  )

  // const onChangeText = React.useCallback(
  //   (text: string) => {
  //     lastTextRef.current = text
  //     const skipThrottle = lastTextRef.current.length > 0 && text.length === 0
  //     setUnsentText(text)

  //     // If the input bar has been cleared, send typing notification right away
  //     if (skipThrottle) {
  //       sendTypingThrottled.cancel()
  //       sendTyping(false)
  //     } else {
  //       sendTypingThrottled(!!text)
  //     }

  //     const skipDebounce = text.startsWith('/')

  //     if (skipDebounce) {
  //       unsentTextChangedThrottled.cancel()
  //       unsentTextChanged(text)
  //     } else {
  //       unsentTextChangedThrottled(text)
  //     }
  //   },
  //   [sendTyping, sendTypingThrottled, setUnsentText, unsentTextChanged, unsentTextChangedThrottled]
  // )

  // const [lastUnsentText, setLastUnsentText] = React.useState<string | undefined>()

  // if (lastUnsentText !== unsentText) {
  //   console.log('aaaa unsent text changed, update', lastUnsentText, unsentText)
  //   setLastUnsentText(unsentText)
  //   if (unsentText !== undefined) {
  //     lastTextRef.current = unsentText
  //     setTextInput(lastTextRef.current)
  //   }
  // }
  // needs to be an effect since setTextInput needs a mounted ref
  // React.useEffect(() => {
  //   console.log('aaaa effect', lastTextRef.current)
  //   setTextInput(lastTextRef.current)
  // }, [setTextInput])

  // console.log('aaaa render', lastTextRef.current)

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
  const hintText = useHintText({cannotWrite, conversationIDKey, isEditing, isExploding, minWriterRole})

  if (lastCID !== conversationIDKey) {
    console.log('aaa CID changed', lastCID, conversationIDKey)
    setLastCID(conversationIDKey)
    setLastDraft(undefined)
    injectText('')
  }
  if (lastDraft !== draft) {
    console.log('aaa draft changed', lastDraft, draft)
    setLastDraft(draft)
    if (draft) {
      injectText(draft)
    }
  }

  // when cid changes we see if we should inject a draft or other injection once
  const injectRef = React.useRef<string>('')
  React.useEffect(() => {
    if (injectRef.current === conversationIDKey) return // once per change of convo
    injectRef.current = conversationIDKey

    // prefer injection
    if (unsentText) {
      injectText(unsentText)
      resetUnsentText()
    } else if (draft) {
      injectText(draft)
    }
  }, [conversationIDKey, draft, injectText, unsentText])

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
