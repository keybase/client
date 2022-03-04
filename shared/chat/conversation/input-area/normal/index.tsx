import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import {isLargeScreen} from '../../../../constants/platform'
import PlatformInput from './platform-input'
import {indefiniteArticle} from '../../../../util/string'
import type {InputProps} from './types'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import ReplyPreview from '../../reply-preview/container'
import {infoPanelWidthTablet} from '../../info-panel/common'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)
const debounced = debounce((f, param) => f(param), 500)

type InputState = {
  showBotCommandUpdateStatus: boolean
}

class Input extends React.Component<InputProps, InputState> {
  _lastQuote: number
  _input: Kb.PlainInput | null = null
  _lastText?: string
  _maxCmdLength = 0

  constructor(props: InputProps) {
    super(props)
    this.state = {showBotCommandUpdateStatus: false}
    this._lastQuote = 0

    if (this.props.suggestCommands) {
      // + 1 for '/'
      this._maxCmdLength =
        this.props.suggestCommands
          .concat(this.props.suggestBotCommands || [])
          .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
    }
  }

  _inputSetRef = (input: null | Kb.PlainInput) => {
    this._input = input
  }

  _inputFocus = () => {
    this.props.isActiveForFocus && this._input && this._input.focus()
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this._setText('')
  }

  _onChangeText = (text: string) => {
    const skipThrottle = this._lastText && this._lastText.length > 0 && text.length === 0
    this.props.setUnsentText(text)
    this._lastText = text

    // If the input bar has been cleared, send typing notification right away
    if (skipThrottle) {
      throttled.cancel()
      this.props.sendTyping(false)
    } else {
      throttled(this.props.sendTyping, !!text)
    }

    // check if input matches a command with help text,
    // skip debouncing unsentText if so
    const trimmedText = text.trim()
    let skipDebounce = false
    if (text.length <= this._maxCmdLength) {
      skipDebounce =
        !!this.props.suggestCommands.find(sc => sc.hasHelpText && `/${sc.name}` === trimmedText) ||
        !!this.props.suggestBotCommands.find(sc => sc.hasHelpText && `!${sc.name}` === trimmedText) ||
        trimmedText === '!'
    }

    // Handle the command status bar
    if (text.startsWith('!') && !this.state.showBotCommandUpdateStatus) {
      this.setState({showBotCommandUpdateStatus: true})
    } else if (!text.startsWith('!') && this.state.showBotCommandUpdateStatus) {
      this.setState({showBotCommandUpdateStatus: false})
    }

    if (skipDebounce) {
      debounced.cancel()
      this.props.unsentTextChanged(text)
    } else {
      debounced(this.props.unsentTextChanged, text)
    }
  }

  _onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey)) {
      e.preventDefault()
      if (this._lastText) {
        this._onSubmit(this._lastText)
      }
    }
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    if (this._input) {
      this._input.transformText(
        () => ({
          selection: {end: text.length, start: text.length},
          text,
        }),
        true
      )
    }

    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }
    throttled(this.props.sendTyping, !!text)
  }

  componentDidMount() {
    // Set lastQuote so we only inject quoted text after we mount.
    this._lastQuote = this.props.quoteCounter

    const text = this.props.getUnsentText()
    this._setText(text, true)
  }

  componentDidUpdate(prevProps: InputProps) {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }

    if (this.props.isActiveForFocus !== prevProps.isActiveForFocus) {
      this._inputFocus()
    }

    if (this.props.isEditing && this.props.isEditExploded) {
      this.props.onCancelEditing()
    }

    // Inject the appropriate text when entering or existing edit
    // mode, but only when on the same conversation; otherwise we'd
    // incorrectly inject when switching to/from a conversation with
    // an unsent edit.
    if (prevProps.conversationIDKey === this.props.conversationIDKey) {
      if (!prevProps.isEditing && this.props.isEditing) {
        this._setText(this.props.editText)
        this._inputFocus()
        return
      }

      if (prevProps.isEditing && !this.props.isEditing) {
        this._setText('')
        return
      }

      if (
        this.props.unsentText !== prevProps.unsentText ||
        this.props.prependText !== prevProps.prependText
      ) {
        this._setText(this.props.getUnsentText(), true)
        this._inputFocus()
        return
      }
    }

    // Inject the appropriate text when quoting. Keep track of the
    // last quote we did so as to inject exactly once.
    if (this.props.quoteCounter > this._lastQuote) {
      this._lastQuote = this.props.quoteCounter
      this._setText(this.props.quoteText)
      this._inputFocus()
      return
    }

    if (
      prevProps.suggestBotCommands != this.props.suggestBotCommands ||
      prevProps.suggestCommands != this.props.suggestCommands
    ) {
      if (this.props.suggestCommands) {
        // different commands so we need to recalculate max command length
        // + 1 for '/'
        this._maxCmdLength =
          this.props.suggestCommands
            .concat(this.props.suggestBotCommands || [])
            .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
      }
    }

    // Otherwise, inject unsent text. This must come after quote
    // handling, so as to handle the 'Reply Privately' case.
    if (prevProps.conversationIDKey !== this.props.conversationIDKey) {
      const text = this.props.getUnsentText()
      this._setText(text, true)
      // TODO: Ideally, we'd also stash and restore the selection.
      // Bring up the keyboard as a result of switching convo, but only on phone, not tablet.
      if (!this.props.isSearching && !Constants.isSplit) {
        this._inputFocus()
      }
    }
  }

  render() {
    const {
      suggestTeams,
      suggestUsers,
      suggestChannels,
      suggestAllChannels,
      suggestCommands,
      isActiveForFocus,
      infoPanelShowing,
      ...platformInputProps
    } = this.props

    let hintText = ''
    if (Styles.isMobile && this.props.isExploding) {
      hintText = isLargeScreen ? `Write an exploding message` : 'Exploding message'
    } else if (this.props.cannotWrite) {
      hintText = `You must be at least ${indefiniteArticle(this.props.minWriterRole)} ${
        this.props.minWriterRole
      } to post.`
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.isExploding) {
      hintText = 'Write an exploding message'
    } else {
      hintText = this.props.inputHintText || 'Write a message'
    }

    return (
      <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
        {this.props.showReplyPreview && <ReplyPreview conversationIDKey={this.props.conversationIDKey} />}
        {
          /*TODO move this into suggestors*/ this.props.showCommandMarkdown && (
            <CommandMarkdown conversationIDKey={this.props.conversationIDKey} />
          )
        }
        {this.props.showCommandStatus && <CommandStatus conversationIDKey={this.props.conversationIDKey} />}
        {this.props.showGiphySearch && <Giphy conversationIDKey={this.props.conversationIDKey} />}
        <PlatformInput
          {...platformInputProps}
          hintText={hintText}
          maxInputArea={this.props.maxInputArea}
          suggestionOverlayStyle={Styles.collapseStyles([
            styles.suggestionOverlay,
            infoPanelShowing && styles.suggestionOverlayWithInfoPanel,
          ])}
          suggestBotCommandsUpdateStatus={this.props.suggestBotCommandsUpdateStatus}
          onKeyDown={this._onKeyDown}
          onSubmit={this._onSubmit}
          inputSetRef={this._inputSetRef}
          onChangeText={this._onChangeText}
        />
      </Kb.Box2>
    )
  }
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
      suggestionOverlayWithInfoPanel: Styles.platformStyles({
        isTablet: {marginRight: infoPanelWidthTablet},
      }),
    } as const)
)

export type Props = InputProps
export default Input
