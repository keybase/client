// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import {emojiIndex} from 'emoji-mart'
import PlatformInput from './platform-input'
import {type InputProps} from './types'
import {throttle} from 'lodash-es'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)

const suggestorToMarker = {
  emoji: ':',
  users: '@',
}

const suggestorKeyExtractors = {
  emoji: item => item.id,
  users: ({username, fullName}: {username: string, fullName: string}) => username,
}

const emojiDatasource = (filter: string) => (filter.length >= 2 ? emojiIndex.search(filter) : [])
const emojiRenderer = (item, selected: boolean) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={{
      alignItems: 'center',
      backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
    }}
    gap="small"
  >
    <Kb.Emoji emojiName={item.colons} size={40} />
    <Kb.Text type="Body">{item.colons}</Kb.Text>
  </Kb.Box2>
)
const emojiTransformer = input => input

class Input extends React.PureComponent<InputProps> {
  _lastQuote: number
  _input: ?Kb.PlainInput
  _lastText: ?string
  _suggestorDatasource: {}
  _suggestorRenderer: {}
  _suggestorTransformer: {}

  constructor(props: InputProps) {
    super(props)
    this._lastQuote = 0
    this._suggestorDatasource = {emoji: emojiDatasource, users: this._getUserSuggestions}
    this._suggestorRenderer = {emoji: emojiRenderer, users: this._renderUserSuggestion}
    this._suggestorTransformer = {emoji: emojiTransformer, users: this._transformUserSuggestion}
  }

  _inputSetRef = (input: null | Kb.PlainInput) => {
    this._input = input
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this._setText('')
  }

  _onChangeText = (text: string) => {
    this.props.setUnsentText(text)
    this._lastText = text
    throttled(this.props.sendTyping, text)
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey) && this._lastText) {
      const toSubmit = this._lastText
      e.preventDefault()
      this._onSubmit(toSubmit)
    }
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    if (this._input) {
      this._input.transformText(() => ({
        selection: {end: text.length, start: text.length},
        text,
      }))
    }

    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }
    throttled(this.props.sendTyping, text)
  }

  componentDidMount = () => {
    // Set lastQuote so we only inject quoted text after we mount.
    this._lastQuote = this.props.quoteCounter

    const text = this.props.getUnsentText()
    this._setText(text, true)
  }

  componentDidUpdate = (prevProps: InputProps) => {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
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
    }

    // Inject the appropriate text when quoting. Keep track of the
    // last quote we did so as to inject exactly once.
    if (this.props.quoteCounter > this._lastQuote) {
      this._lastQuote = this.props.quoteCounter
      this._setText(this.props.quoteText)
      this._inputFocus()
      return
    }

    // Otherwise, inject unsent text. This must come after quote
    // handling, so as to handle the 'Reply Privately' case.
    if (prevProps.conversationIDKey !== this.props.conversationIDKey) {
      const text = this.props.getUnsentText()
      this._setText(text, true)
    }
  }

  _getUserSuggestions = filter =>
    this.props.suggestUsers
      .filter(user => user.username.includes(filter) || user.fullName.includes(filter))
      .toArray()

  _renderUserSuggestion = ({username, fullName}: {username: string, fullName: string}, selected: boolean) => (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xtiny,
      }}
      gap="small"
    >
      {!Constants.isSpecialMention(username) ? (
        <Kb.Avatar username={username} size={32} />
      ) : (
        <Kb.Icon
          type="iconfont-people"
          style={{
            padding: Styles.globalMargins.xtiny,
          }}
          color={Styles.globalColors.blue}
          fontSize={24}
        />
      )}{' '}
      <Kb.ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
      <Kb.Text type="BodySmall">{fullName}</Kb.Text>
    </Kb.Box2>
  )

  _transformUserSuggestion = input => input

  render = () => {
    const {suggestUsers, suggestChannels, ...platformInputProps} = this.props
    return (
      <PlatformInput
        {...platformInputProps}
        dataSources={this._suggestorDatasource}
        renderers={this._suggestorRenderer}
        suggestorToMarker={suggestorToMarker}
        keyExtractors={suggestorKeyExtractors}
        transformers={this._suggestorTransformer}
        onKeyDown={this._onKeyDown}
        onSubmit={this._onSubmit}
        inputSetRef={this._inputSetRef}
        onChangeText={this._onChangeText}
      />
    )
  }
}

export type {InputProps as Props}

export default Input
