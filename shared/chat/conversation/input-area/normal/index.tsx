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
import {memoize} from '../../../../util/memoize'
import CommandMarkdown from '../../command-markdown/container'
import CommandStatus from '../../command-status/container'
import Giphy from '../../giphy/container'
import ReplyPreview from '../../reply-preview/container'
import {infoPanelWidthTablet} from '../../info-panel/common'
import {emojiIndex, emojiNameMap} from '../../messages/react-button/emoji-picker/data'
import {type EmojiData, RPCToEmojiData} from '../../../../util/emoji'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)
const debounced = debounce((f, param) => f(param), 500)

const searchUsersAndTeamsAndTeamChannels = memoize(
  (
    users: InputProps['suggestUsers'],
    teams: InputProps['suggestTeams'],
    allChannels: InputProps['suggestAllChannels'],
    filter: string
  ) => {
    if (!filter) {
      return [...users, ...teams]
    }
    const fil = filter.toLowerCase()
    const match = fil.match(/^([a-zA-Z0-9_.]+)#(\S*)$/) // team name followed by #
    if (match) {
      const teamname = match[1]
      const channelfil = match[2]
      if (!channelfil) {
        // All the team's channels
        return allChannels.filter(v => v.teamname === teamname)
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
    const sortedTeams = teams.filter(t => {
      return t.teamname.includes(fil)
    })
    const usersAndTeams = [...sortedUsers, ...sortedTeams]
    if (usersAndTeams.length === 1 && usersAndTeams[0].teamname) {
      // The only user+team result is a single team. Present its channels as well.
      return [...usersAndTeams, ...allChannels.filter(v => v.teamname === usersAndTeams[0].teamname)]
    }
    return usersAndTeams
  }
)

// 2+ valid emoji chars and no ending colon
const emojiPrepass = /[a-z0-9_]{2,}(?!.*:)/i

type InputState = {
  showBotCommandUpdateStatus: boolean
}

class Input extends React.Component<InputProps, InputState> {
  _lastQuote: number
  _input: Kb.PlainInput | null = null
  _lastText?: string
  _suggestorDatasource = {}
  _suggestorRenderer = {}
  _maxCmdLength = 0

  constructor(props: InputProps) {
    super(props)
    this.state = {showBotCommandUpdateStatus: false}
    this._lastQuote = 0
    this._suggestorDatasource = {
      channels: (filter: string) => {
        const fil = filter.toLowerCase()
        return {
          data: this.props.suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)).sort(),
          loading: this.props.suggestChannelsLoading,
          useSpaces: false,
        }
      },
      commands: (filter: string) => {
        if (this.props.showCommandMarkdown || this.props.showGiphySearch) {
          return {
            data: [],
            loading: false,
            useSpaces: true,
          }
        }

        const sel = this._input?.getSelection()
        if (sel && this._lastText) {
          // a little messy. Check if the message starts with '/' and that the cursor is
          // within maxCmdLength chars away from it. This happens before `onChangeText`, so
          // we can't do a more robust check on `this._lastText` because it's out of date.
          if (
            !(this._lastText.startsWith('/') || this._lastText.startsWith('!')) ||
            (sel.start || 0) > this._maxCmdLength
          ) {
            // not at beginning of message
            return {
              data: [],
              loading: false,
              useSpaces: true,
            }
          }
        }
        const fil = filter.toLowerCase()
        const data = (
          this._lastText?.startsWith('!') ? this.props.suggestBotCommands : this.props.suggestCommands
        ).filter(c => c.name.includes(fil))
        return {
          data,
          loading: false,
          useSpaces: true,
        }
      },
      emoji: (filter: string) => {
        if (!emojiPrepass.test(filter)) {
          return {
            data: [],
            loading: false,
            useSpaces: false,
          }
        }

        // prefill data with stock emoji
        let emojiData: Array<EmojiData> = []
        emojiIndex.search(filter)?.forEach((res: {id?: string}) => {
          if (res.id) {
            emojiData.push(emojiNameMap[res.id])
          }
        })

        if (this.props.userEmojis) {
          const userEmoji = this.props.userEmojis
            .filter(emoji => emoji.alias.toLowerCase().includes(filter))
            .map(emoji => RPCToEmojiData(emoji, false))
          emojiData = userEmoji.sort((a, b) => a.short_name.localeCompare(b.short_name)).concat(emojiData)
        }

        return {
          data: emojiData,
          loading: this.props.userEmojisLoading,
          useSpaces: false,
        }
      },
      users: (filter: string) => ({
        data: searchUsersAndTeamsAndTeamChannels(
          this.props.suggestUsers,
          this.props.suggestTeams,
          this.props.suggestAllChannels,
          filter
        ),
        loading: false,
        useSpaces: false,
      }),
    }

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
        {this.props.showCommandMarkdown && (
          <CommandMarkdown conversationIDKey={this.props.conversationIDKey} />
        )}
        {this.props.showCommandStatus && <CommandStatus conversationIDKey={this.props.conversationIDKey} />}
        {this.props.showGiphySearch && <Giphy conversationIDKey={this.props.conversationIDKey} />}
        <PlatformInput
          {...platformInputProps}
          hintText={hintText}
          dataSources={this._suggestorDatasource}
          maxInputArea={this.props.maxInputArea}
          renderers={this._suggestorRenderer}
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
