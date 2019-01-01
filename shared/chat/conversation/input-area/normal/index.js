// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import {emojiIndex} from 'emoji-mart'
import PlatformInput from './platform-input'
import {standardTransformer} from '../suggestors'
import {type InputProps} from './types'
import {debounce, throttle} from 'lodash-es'
import {memoize} from '../../../../util/memoize'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)
const debounced = debounce((f, param) => f(param), 500)

const searchUsers = memoize((users, filter) => {
  if (!filter) {
    return users.toArray()
  }
  const fil = filter.toLowerCase()
  return users
    .map(u => {
      let score = 0
      const username = u.username.toLowerCase()
      const fullName = u.fullName.toLowerCase()
      if (username.includes(fil) || fullName.includes(fil)) {
        // 1 point for included somewhere
        score++
      }
      if (fullName.startsWith(fil)) {
        // 1 point for start of fullname
        score++
      }
      if (username.startsWith(fil)) {
        // 2 points for start of username
        score += 2
      }
      return {score, user: u}
    })
    .filter(withScore => !!withScore.score)
    .sort((a, b) => b.score - a.score)
    .map(userWithScore => userWithScore.user)
    .toArray()
})

const suggestorToMarker = {
  channels: '#',
  emoji: ':',
  users: /^((\+\d+(\.\d+)?[a-zA-Z]{3,12}@)|@)/, // match normal mentions and ones in a stellar send
}

const suggestorKeyExtractors = {
  emoji: (item: {id: string}) => item.id,
  users: ({username, fullName}: {username: string, fullName: string}) => username,
}

const emojiDatasource = (filter: string) => (filter.length >= 2 ? emojiIndex.search(filter) : [])
const emojiRenderer = (item, selected: boolean) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.suggestionBase,
      {
        backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
      },
    ])}
    gap="small"
  >
    <Kb.Emoji emojiName={item.colons} size={24} />
    <Kb.Text type="BodySmallSemibold">{item.colons}</Kb.Text>
  </Kb.Box2>
)
const emojiTransformer = (emoji: {colons: string, native: string}, marker, tData, preview) => {
  const toInsert = Styles.isMobile ? emoji.native : emoji.colons
  return standardTransformer(toInsert, tData, preview)
}

type InputState = {
  inputHeight: number,
}

class Input extends React.Component<InputProps, InputState> {
  _lastQuote: number
  _input: ?Kb.PlainInput
  _lastText: ?string
  _suggestorDatasource = {}
  _suggestorRenderer = {}
  _suggestorTransformer = {}

  constructor(props: InputProps) {
    super(props)
    this.state = {inputHeight: 0}
    this._lastQuote = 0
    this._suggestorDatasource = {
      channels: this._getChannelSuggestions,
      emoji: emojiDatasource,
      users: this._getUserSuggestions,
    }
    this._suggestorRenderer = {
      channels: this._renderChannelSuggestion,
      emoji: emojiRenderer,
      users: this._renderUserSuggestion,
    }
    this._suggestorTransformer = {
      channels: this._transformChannelSuggestion,
      emoji: emojiTransformer,
      users: this._transformUserSuggestion,
    }
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
    debounced(this.props.unsentTextChanged, text)
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey) && !isComposingIME) {
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
    throttled(this.props.sendTyping, text)
  }

  _setHeight = (inputHeight: number) =>
    this.setState(s => (s.inputHeight === inputHeight ? null : {inputHeight}))

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
      // TODO: Ideally, we'd also stash and restore the selection.
      this._inputFocus()
    }
  }

  _getUserSuggestions = filter => searchUsers(this.props.suggestUsers, filter)

  _renderUserSuggestion = ({username, fullName}: {username: string, fullName: string}, selected: boolean) => (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {
          backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
        },
      ])}
      gap="small"
    >
      {Constants.isSpecialMention(username) ? (
        <Kb.Icon
          type="iconfont-people"
          style={styles.paddingXTiny}
          color={Styles.globalColors.blue}
          fontSize={24}
        />
      ) : (
        <Kb.Avatar username={username} size={32} />
      )}
      <Kb.ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
      <Kb.Text type="BodySmall">{fullName}</Kb.Text>
    </Kb.Box2>
  )

  _transformUserSuggestion = (input: {fullName: string, username: string}, marker, tData, preview: boolean) =>
    standardTransformer(`${marker}${input.username}`, tData, preview)

  _getChannelSuggestions = filter => {
    const fil = filter.toLowerCase()
    return this.props.suggestChannels.filter(ch => ch.toLowerCase().includes(fil)).toArray()
  }

  _renderChannelSuggestion = (channelname: string, selected) => (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {
          backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
        },
      ])}
    >
      <Kb.Text type="BodySemibold">#{channelname}</Kb.Text>
    </Kb.Box2>
  )

  _transformChannelSuggestion = (channelname, marker, tData, preview) =>
    standardTransformer(`${marker}${channelname}`, tData, preview)

  render = () => {
    const {suggestUsers, suggestChannels, ...platformInputProps} = this.props
    return (
      <PlatformInput
        {...platformInputProps}
        dataSources={this._suggestorDatasource}
        renderers={this._suggestorRenderer}
        suggestorToMarker={suggestorToMarker}
        suggestionListStyle={Styles.collapseStyles([
          styles.suggestionList,
          !!this.state.inputHeight && {marginBottom: this.state.inputHeight},
        ])}
        suggestionOverlayStyle={styles.suggestionOverlay}
        keyExtractors={suggestorKeyExtractors}
        transformers={this._suggestorTransformer}
        onKeyDown={this._onKeyDown}
        onSubmit={this._onSubmit}
        setHeight={this._setHeight}
        inputSetRef={this._inputSetRef}
        onChangeText={this._onChangeText}
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  fixSuggestionHeight: {height: 40},
  paddingXTiny: {
    padding: Styles.globalMargins.xtiny,
  },
  suggestionBase: {
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  suggestionList: Styles.platformStyles({
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderStyle: 'solid',
      borderTopWidth: 3,
      maxHeight: '50%',
      overflow: 'hidden',
    },
  }),
  suggestionOverlay: Styles.platformStyles({
    isElectron: {marginLeft: 15, marginRight: 15, marginTop: 'auto'},
  }),
})

export type {InputProps as Props}

export default Input
