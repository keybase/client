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
import type {InputProps} from './types'
import {indefiniteArticle} from '../../../../util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {isLargeScreen} from '../../../../constants/platform'

const unsentTextMap = new Map<Types.ConversationIDKey, string>()

const Input = (props: InputProps) => {
  const {
    suggestTeams,
    suggestUsers,
    suggestChannels,
    suggestAllChannels,
    suggestCommands,
    suggestBotCommands,
    isActiveForFocus,
    infoPanelShowing,
    ...platformInputProps
  } = props
  const {onSubmit, sendTyping, conversationIDKey, focusInputCounter, isEditing, isEditExploded} = props

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
  const maxCmdLengthRef = React.useRef(0)

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

      // check if input matches a command with help text,
      // skip debouncing unsentText if so
      const trimmedText = text.trim()
      let skipDebounce = false
      if (text.length <= maxCmdLengthRef.current) {
        skipDebounce =
          !!suggestCommands.find(sc => sc.hasHelpText && `/${sc.name}` === trimmedText) ||
          !!suggestBotCommands.find(sc => sc.hasHelpText && `!${sc.name}` === trimmedText) ||
          trimmedText === '!'
      }

      if (skipDebounce) {
        unsentTextChangedDebounced.cancel()
        unsentTextChanged(text)
      } else {
        unsentTextChangedDebounced(text)
      }
    },
    [setUnsentText, suggestCommands, suggestBotCommands, unsentTextChanged]
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
  if (Styles.isMobile && props.isExploding) {
    hintText = isLargeScreen ? `Write an exploding message` : 'Exploding message'
  } else if (props.cannotWrite) {
    hintText = `You must be at least ${indefiniteArticle(props.minWriterRole)} ${
      props.minWriterRole
    } to post.`
  } else if (props.isEditing) {
    hintText = 'Edit your message'
  } else if (props.isExploding) {
    hintText = 'Write an exploding message'
  } else {
    hintText = props.inputHintText || 'Write a message'
  }

  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      {props.showReplyPreview && <ReplyPreview conversationIDKey={props.conversationIDKey} />}
      {
        /*TODO move this into suggestors*/ props.showCommandMarkdown && (
          <CommandMarkdown conversationIDKey={props.conversationIDKey} />
        )
      }
      {props.showCommandStatus && <CommandStatus conversationIDKey={props.conversationIDKey} />}
      {props.showGiphySearch && <Giphy conversationIDKey={props.conversationIDKey} />}
      <PlatformInput
        {...platformInputProps}
        hintText={hintText}
        maxInputArea={props.maxInputArea}
        suggestionOverlayStyle={
          infoPanelShowing ? styles.suggestionOverlayInfoShowing : styles.suggestionOverlay
        }
        suggestBotCommandsUpdateStatus={props.suggestBotCommandsUpdateStatus}
        onSubmit={onSubmitAndClear}
        inputSetRef={inputRef}
        onChangeText={onChangeText}
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

export type Props = InputProps
export default Input
