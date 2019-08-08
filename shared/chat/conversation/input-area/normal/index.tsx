import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import {emojiIndex} from 'emoji-mart'
import PlatformInput from './platform-input'
import {standardTransformer} from '../suggestors'
import {InputProps} from './types'
import {debounce, throttle} from 'lodash-es'
import {memoize} from '../../../../util/memoize'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import ReplyPreview from '../../reply-preview/container'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)
const debounced = debounce((f, param) => f(param), 500)

const searchUsersAndTeamsAndTeamChannels = memoize((users, teams, allChannels, filter) => {
  if (!filter) {
    return users.concat(teams).toArray()
  }
  const fil = filter.toLowerCase()
  let match = fil.match(/^([a-zA-Z0-9_.]+)#(\S*)$/) // team name followed by #
  if (match) {
    let teamname = match[1]
    const channelfil = match[2]
    if (!channelfil) {
      // All the team's channels
      return allChannels.filter(v => v.teamname === teamname).toArray()
    }
    return allChannels
      .filter(v => v.teamname === teamname)
      .map(v => {
        let score = 0
        const channelname = v.channelname.toLowerCase()
        if (channelname.includes(channelfil)) {
          score++
        }
        if (channelname.startsWith(channelfil)) {
          score += 2
        }
        return {score, v}
      })
      .filter(withScore => !!withScore.score)
      .sort((a, b) => b.score - a.score)
      .map(({v}) => v)
      .toArray()
  }
  const sortedUsers = users
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
  const sortedTeams = teams.filter(t => {
    return t.teamname.includes(fil)
  })
  let usersAndTeams = sortedUsers.concat(sortedTeams)
  if (usersAndTeams.length === 1 && usersAndTeams[0].teamname) {
    // The only user+team result is a single team. Present its channels as well.
    return usersAndTeams.concat(allChannels.filter(v => v.teamname === usersAndTeams[0].teamname).toArray())
  }
  return usersAndTeams
})

const suggestorToMarker = {
  channels: '#',
  commands: /(!|\/)/,
  emoji: ':',
  // 'users' is for @user, @team, and @team#channel
  users: /^((\+\d+(\.\d+)?[a-zA-Z]{3,12}@)|@)/, // match normal mentions and ones in a stellar send
}

const suggestorKeyExtractors = {
  commands: (c: RPCChatTypes.ConversationCommand) => c.name + c.username,
  emoji: (item: {id: string}) => item.id,
  users: ({username, teamname, channelname}: {username: string; teamname?: string; channelname?: string}) => {
    if (teamname) {
      if (channelname) {
        return teamname + '#' + channelname
      } else {
        return teamname
      }
    } else {
      return username
    }
  },
}

// 2+ valid emoji chars and no ending colon
const emojiPrepass = /[a-z0-9_]{2,}(?!.*:)/i
const emojiDatasource = (filter: string) => (emojiPrepass.test(filter) ? emojiIndex.search(filter) : [])
const emojiRenderer = (item, selected: boolean) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.suggestionBase,
      {
        backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
      },
    ])}
    gap="small"
  >
    <Kb.Emoji emojiName={item.colons} size={24} />
    <Kb.Text type="BodySmallSemibold">{item.colons}</Kb.Text>
  </Kb.Box2>
)
const emojiTransformer = (
  emoji: {
    colons: string
    native: string
  },
  _,
  tData,
  preview
) => {
  const toInsert = Styles.isMobile ? emoji.native : emoji.colons
  return standardTransformer(toInsert, tData, preview)
}

type InputState = {
  inputHeight: number
  showBotCommandUpdateStatus: boolean
}

class Input extends React.Component<InputProps, InputState> {
  _lastQuote: number
  _input: Kb.PlainInput | null = null
  _lastText?: string
  _suggestorDatasource = {}
  _suggestorRenderer = {}
  _suggestorTransformer = {}
  _maxCmdLength = 0

  constructor(props: InputProps) {
    super(props)
    this.state = {inputHeight: 0, showBotCommandUpdateStatus: false}
    this._lastQuote = 0
    this._suggestorDatasource = {
      channels: this._getChannelSuggestions,
      commands: this._getCommandSuggestions,
      emoji: emojiDatasource,
      users: this._getUserSuggestions,
    }
    this._suggestorRenderer = {
      channels: this._renderChannelSuggestion,
      commands: this._renderCommandSuggestion,
      emoji: emojiRenderer,
      users: this._renderUserSuggestion,
    }
    this._suggestorTransformer = {
      channels: this._transformChannelSuggestion,
      commands: this._transformCommandSuggestion,
      emoji: emojiTransformer,
      users: this._transformUserSuggestion,
    }
    // + 1 for '/'
    this._maxCmdLength =
      this.props.suggestCommands
        .concat(this.props.suggestBotCommands)
        .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
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

  _onKeyDown = (e: React.KeyboardEvent, isComposingIME: boolean) => {
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
    throttled(this.props.sendTyping, !!text)
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

    // Otherwise, inject unsent text. This must come after quote
    // handling, so as to handle the 'Reply Privately' case.
    if (prevProps.conversationIDKey !== this.props.conversationIDKey) {
      const text = this.props.getUnsentText()
      this._setText(text, true)
      // TODO: Ideally, we'd also stash and restore the selection.
      if (!this.props.isSearching) {
        this._inputFocus()
      }
    }
  }

  _getUserSuggestions = filter =>
    searchUsersAndTeamsAndTeamChannels(
      this.props.suggestUsers,
      this.props.suggestTeams,
      this.props.suggestAllChannels,
      filter
    )

  _getCommandSuggestions = filter => {
    if (this.props.showCommandMarkdown || this.props.showGiphySearch) {
      return []
    }
    const sel = this._input && this._input.getSelection()
    if (sel && this._lastText) {
      // a little messy. Check if the message starts with '/' and that the cursor is
      // within maxCmdLength chars away from it. This happens before `onChangeText`, so
      // we can't do a more robust check on `this._lastText` because it's out of date.
      if (
        !(this._lastText.startsWith('/') || this._lastText.startsWith('!')) ||
        (sel.start || 0) > this._maxCmdLength
      ) {
        // not at beginning of message
        return []
      }
    }
    const fil = filter.toLowerCase()
    return (this._lastText && this._lastText.startsWith('!')
      ? this.props.suggestBotCommands
      : this.props.suggestCommands
    ).filter(c => c.name.includes(fil))
  }

  _renderTeamSuggestion = (teamname, channelname, selected) => (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {
          backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
        },
      ])}
      gap="tiny"
    >
      <Kb.Avatar teamname={teamname} size={32} />
      <Kb.Text type="Body">{channelname ? teamname + ' #' + channelname : teamname}</Kb.Text>
    </Kb.Box2>
  )

  _renderUserSuggestion = (
    {
      username,
      fullName,
      teamname,
      channelname,
    }: {
      username: string
      fullName: string
      teamname?: string
      channelname?: string
    },
    selected: boolean
  ) => {
    return teamname ? (
      this._renderTeamSuggestion(teamname, channelname, selected)
    ) : (
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          styles.suggestionBase,
          styles.fixSuggestionHeight,
          {
            backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
          },
        ])}
        gap="tiny"
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
        <Kb.ConnectedUsernames
          type="Body"
          colorFollowing={true}
          usernames={[username]}
          style={styles.boldStyle}
        />
        <Kb.Text type="BodySmall">{fullName}</Kb.Text>
      </Kb.Box2>
    )
  }

  _transformUserSuggestion = (
    input: {
      fullName: string
      username: string
      teamname?: string
      channelname?: string
    },
    marker,
    tData,
    preview: boolean
  ) => {
    let s
    if (input.teamname) {
      if (input.channelname) {
        s = input.teamname + '#' + input.channelname
      } else {
        s = input.teamname
      }
    } else {
      s = input.username
    }
    return standardTransformer(`${marker}${s}`, tData, preview)
  }

  _getChannelSuggestions = filter => {
    const fil = filter.toLowerCase()
    return this.props.suggestChannels
      .filter(ch => ch.toLowerCase().includes(fil))
      .sort()
      .toArray()
  }

  _renderChannelSuggestion = (channelname: string, selected) => (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {
          backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
        },
      ])}
    >
      <Kb.Text type="BodySemibold">#{channelname}</Kb.Text>
    </Kb.Box2>
  )

  _transformChannelSuggestion = (channelname, marker, tData, preview) =>
    standardTransformer(`${marker}${channelname}`, tData, preview)

  _getCommandPrefix = (command: RPCChatTypes.ConversationCommand) => {
    return command.username ? '!' : '/'
  }

  _renderCommandSuggestion = (command: RPCChatTypes.ConversationCommand, selected) => {
    const prefix = this._getCommandPrefix(command)
    return (
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        style={Styles.collapseStyles([
          styles.suggestionBase,
          {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
          {
            alignItems: 'flex-start',
          },
        ])}
      >
        {!!command.username && <Kb.Avatar size={32} username={command.username} />}
        <Kb.Box2
          fullWidth={true}
          direction="vertical"
          style={Styles.collapseStyles([
            styles.fixSuggestionHeight,
            {
              alignItems: 'flex-start',
            },
          ])}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
            <Kb.Text type="BodySemibold" style={styles.boldStyle}>
              {prefix}
              {command.name}
            </Kb.Text>
            <Kb.Text type="Body">{command.usage}</Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall">{command.description}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  _transformCommandSuggestion = (command, _, tData, preview) => {
    const prefix = this._getCommandPrefix(command)
    return standardTransformer(`${prefix}${command.name}`, tData, preview)
  }

  render = () => {
    const {
      suggestTeams,
      suggestUsers,
      suggestChannels,
      suggestAllChannels,
      suggestCommands,
      isActiveForFocus,
      ...platformInputProps
    } = this.props
    return (
      <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
        {this.props.showReplyPreview && <ReplyPreview conversationIDKey={this.props.conversationIDKey} />}
        {this.props.showCommandMarkdown && (
          <CommandMarkdown conversationIDKey={this.props.conversationIDKey} />
        )}
        {this.props.showCommandStatus && <CommandStatus conversationIDKey={this.props.conversationIDKey} />}
        {this.props.showGiphySearch && <Giphy conversationIDKey={this.props.conversationIDKey} />}
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
          suggestBotCommandsUpdateStatus={this.props.suggestBotCommandsUpdateStatus}
          keyExtractors={suggestorKeyExtractors}
          transformers={this._suggestorTransformer}
          onKeyDown={this._onKeyDown}
          onSubmit={this._onSubmit}
          setHeight={this._setHeight}
          inputSetRef={this._inputSetRef}
          onChangeText={this._onChangeText}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  boldStyle: {
    fontWeight: '700',
  },
  container: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-end',
      maxHeight: '70%',
    },
  }),
  fixSuggestionHeight: Styles.platformStyles({
    isMobile: {height: 48},
  }),
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
}))

export type Props = InputProps
export default Input
