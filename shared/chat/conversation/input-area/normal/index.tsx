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
// import debounce from 'lodash/debounce'
// import throttle from 'lodash/throttle'
import type * as Types from '../../../../constants/types/chat2'
import type {InputProps} from './types'
import {indefiniteArticle} from '../../../../util/string'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {isLargeScreen} from '../../../../constants/platform'

const unsentTextMap = new Map<Types.ConversationIDKey, string>()

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
// const throttled = throttle((f, param) => f(param), 2000)
// const debounced = debounce((f, param) => f(param), 500)

const Input = (props: InputProps) => {
  // _lastQuote: number
  // _input: Kb.PlainInput | null = null
  // _lastText?: string
  // _maxCmdLength = 0

  // constructor(props: InputProps) {
  //   super(props)
  //   this._lastQuote = 0

  //   if (this.props.suggestCommands) {
  //     // + 1 for '/'
  //     this._maxCmdLength =
  //       this.props.suggestCommands
  //         .concat(this.props.suggestBotCommands || [])
  //         .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
  //   }
  // }

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
  const {onSubmit, sendTyping, conversationIDKey, focusInputCounter} = props

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

  const clearPrependText = React.useCallback(() => {
    dispatch(Chat2Gen.createSetPrependText({conversationIDKey, text: null}))
  }, [dispatch, conversationIDKey])

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
      clearPrependText()
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

    console.log(
      'aaa unsettext changed',
      text,
      state.chat2.unsentTextMap.get(conversationIDKey)?.stringValue(),
      unsentTextMap.get(conversationIDKey)
    )
    if (text !== undefined) {
      const prependText = state.chat2.prependTextMap.get(conversationIDKey)?.stringValue() ?? ''
      return prependText + text
    }

    // fallback on meta
    return Constants.getDraft(state, conversationIDKey) ?? ''
  })

  React.useEffect(() => {
    setText(unsentText)
  }, [unsentText])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [focusInputCounter, isActiveForFocus])

  // componentDidUpdate(prevProps: InputProps) {
  //   if (this.props.isEditing && this.props.isEditExploded) {
  //     this.props.onCancelEditing()
  //   }

  //   // Inject the appropriate text when entering or existing edit
  //   // mode, but only when on the same conversation; otherwise we'd
  //   // incorrectly inject when switching to/from a conversation with
  //   // an unsent edit.
  //   if (prevProps.conversationIDKey === this.props.conversationIDKey) {
  //     if (!prevProps.isEditing && this.props.isEditing) {
  //       this._setText(this.props.editText)
  //       this._inputFocus()
  //       return
  //     }

  //     if (prevProps.isEditing && !this.props.isEditing) {
  //       this._setText('')
  //       return
  //     }

  //     if (
  //       this.props.unsentText !== prevProps.unsentText ||
  //       this.props.prependText !== prevProps.prependText
  //     ) {
  //       this._setText(this.props.getUnsentText(), true)
  //       this._inputFocus()
  //       return
  //     }
  //   }

  //   // Inject the appropriate text when quoting. Keep track of the
  //   // last quote we did so as to inject exactly once.
  //   if (this.props.quoteCounter > this._lastQuote) {
  //     this._lastQuote = this.props.quoteCounter
  //     this._setText(this.props.quoteText)
  //     this._inputFocus()
  //     return
  //   }

  //   if (
  //     prevProps.suggestBotCommands != this.props.suggestBotCommands ||
  //     prevProps.suggestCommands != this.props.suggestCommands
  //   ) {
  //     if (this.props.suggestCommands) {
  //       // different commands so we need to recalculate max command length
  //       // + 1 for '/'
  //       this._maxCmdLength =
  //         this.props.suggestCommands
  //           .concat(this.props.suggestBotCommands || [])
  //           .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
  //     }
  //   }

  // Otherwise, inject unsent text. This must come after quote
  //   // handling, so as to handle the 'Reply Privately' case.
  //   if (prevProps.conversationIDKey !== this.props.conversationIDKey) {
  //     const text = this.props.getUnsentText()
  //     this._setText(text, true)
  //     // TODO: Ideally, we'd also stash and restore the selection.
  //     // Bring up the keyboard as a result of switching convo, but only on phone, not tablet.
  //     if (!this.props.isSearching && !Constants.isSplit) {
  //       this._inputFocus()
  //     }
  //   }
  // }

  // render()

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
