// @flow
/* eslint-env browser */
import logger from '../../../logger'
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {compose, withState, withHandlers} from 'recompose'
import ConnectedMentionHud from '../../hud/mention-hud-container'

import type {Props} from '.'

type InputProps = {
  inputSelections: () => {selectionStart?: number, selectionEnd?: number},
  emojiPickerOpen: boolean,
  emojiPickerToggle: () => void,
  filePickerFiles: () => Array<any>,
  filePickerOpen: () => void,
  filePickerSetValue: (value: any) => void,
  filePickerSetRef: (r: any) => void,
  mentionPopupOpen: boolean,
  setMentionPopupOpen: (setOpen: boolean) => void,
  mentionFilter: string,
  setMentionFilter: (filter: string) => void,
} & Props

type State = {
  upArrowCounter: number,
  downArrowCounter: number,
  pickSelectedCounter: number,
}

const MentionCatcher = ({onClick}) => (
  <Box
    onClick={onClick}
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.transparent,
    }}
  />
)
class ConversationInput extends Component<InputProps, State> {
  state: State
  _inputRef: ?any

  constructor() {
    super()
    this.state = {
      upArrowCounter: 0,
      downArrowCounter: 0,
      pickSelectedCounter: 0,
    }
  }

  componentDidMount() {
    this._registerBodyEvents(true)
  }

  componentWillUnmount() {
    this._registerBodyEvents(false)
  }

  _registerBodyEvents(add: boolean) {
    const body = document.body
    if (!body) {
      return
    }
    const f = add ? body.addEventListener : body.removeEventListener
    f('keydown', this._globalKeyDownHandler)
    f('keypress', this._globalKeyDownHandler)
  }

  _globalKeyDownHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Enter',
    ].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this.props.inputFocus()
    }
  }

  _insertEmoji(emojiColons: string) {
    const {selectionStart = 0, selectionEnd = 0} = this.props.inputSelections()
    const nextText = [
      this.props.text.substring(0, selectionStart),
      emojiColons,
      this.props.text.substring(selectionEnd),
    ].join('')
    this.props.setText(nextText)
    this.props.inputFocus()
  }

  _pickFile = () => {
    const conversationIDKey = this.props.selectedConversationIDKey
    if (!conversationIDKey) {
      throw new Error('No conversation')
    }
    const files = this.props.filePickerFiles()
    if (files.length <= 0) {
      return
    }

    const inputs = Array.prototype.map.call(files, file => {
      const {path, name, type} = file
      return {
        conversationIDKey,
        filename: path,
        title: name,
        type: type.indexOf('image') >= 0 ? 'Image' : 'Other',
      }
    })

    this.props.onAttach(inputs)
    this.props.filePickerSetValue(null)
  }

  _pickerOnClick = emoji => {
    this._insertEmoji(emoji.colons)
    this.props.emojiPickerToggle()
  }

  _triggerUpArrowCounter = () => {
    this.setState(({upArrowCounter}) => ({upArrowCounter: upArrowCounter + 1}))
  }

  _triggerDownArrowCounter = () => {
    this.setState(({downArrowCounter}) => ({downArrowCounter: downArrowCounter + 1}))
  }

  _triggerPickSelectedCounter = () => {
    this.setState(({pickSelectedCounter}) => ({pickSelectedCounter: pickSelectedCounter + 1}))
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    if (e.key === 'ArrowUp' && !this.props.text) {
      this.props.onEditLastMessage()
      return
    }

    if (this.props.mentionPopupOpen) {
      if (e.key === 'Tab') {
        e.preventDefault()
        // If you tab with a partial name typed, we pick the selected item
        if (this.props.mentionFilter.length > 0) {
          this._triggerPickSelectedCounter()
          return
        }
        // else we move you up/down
        if (e.shiftKey) {
          this._triggerUpArrowCounter()
        } else {
          this._triggerDownArrowCounter()
        }
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this._triggerUpArrowCounter()
        return
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        this._triggerDownArrowCounter()
        return
      } else if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this.props.setMentionPopupOpen(false)
        return
      }
    }

    if (e.key === '@') {
      this.props.setMentionPopupOpen(true)
    }

    if (this.props.mentionPopupOpen && e.key === 'Backspace') {
      const lastChar = this.props.text[this.props.text.length - 1]
      if (lastChar === '@') {
        this.props.setMentionPopupOpen(false)
      }
    }
  }

  _onKeyUp = (e: SyntheticKeyboardEvent<*>) => {
    // Ignore moving within the list
    if (this.props.mentionPopupOpen) {
      if (['ArrowUp', 'ArrowDown', 'Shift', 'Tab'].includes(e.key)) {
        // handled above in _onKeyDown
        return
      }
    }

    // Get the word typed so far
    if (this.props.mentionPopupOpen || e.key === 'Backspace') {
      const wordSoFar = this._getWordAtCursor(false)
      if (wordSoFar && wordSoFar[0] === '@') {
        !this.props.mentionPopupOpen && this.props.setMentionPopupOpen(true)
        this.props.setMentionFilter(wordSoFar.substring(1))
      } else {
        this.props.mentionPopupOpen && this.props.setMentionPopupOpen(false)
      }
    }
  }

  _getWordAtCursor(includeWordAfterCursor: boolean): string {
    const text = this._inputRef && this._inputRef.getValue()
    const selections = this._inputRef && this._inputRef.selections()
    if (text && selections && selections.selectionStart === selections.selectionEnd) {
      const upToCursor = text.substring(0, selections.selectionStart)
      const words = upToCursor.split(' ')
      const lastWord = words[words.length - 1]
      if (includeWordAfterCursor) {
        const afterCursor = text.substring(selections.selectionStart)
        const endOfWordMatchIdx = afterCursor.search(/\s/)
        return (
          lastWord + (endOfWordMatchIdx !== -1 ? afterCursor.substring(0, endOfWordMatchIdx) : afterCursor)
        )
      } else {
        return lastWord
      }
    }

    return ''
  }

  _replaceWordAtCursor(newWord: string): void {
    const selections = this._inputRef && this._inputRef.selections()
    const word = this._getWordAtCursor(false)

    if (word && selections && selections.selectionStart === selections.selectionEnd) {
      const startOfWordIdx = selections.selectionStart - word.length
      if (startOfWordIdx >= 0) {
        this._inputRef && this._inputRef.replaceText(newWord, startOfWordIdx, selections.selectionStart)
      }
    }
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
    e.preventDefault()

    if (this.props.mentionPopupOpen) {
      this._triggerPickSelectedCounter()
      return
    }

    if (this.props.isLoading) {
      logger.info('Ignoring chat submit while still loading')
      return
    }
    if (this.props.text) {
      this.props.onPostMessage(this.props.text)
      this.props.setText('')
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.text !== nextProps.text) {
      this.props.onUpdateTyping(!!nextProps.text)
    }
  }

  _inputSetRef(r) {
    this.props.inputSetRef(r)
    this._inputRef = r
  }

  _insertMention = (u: string, options?: {notUser: boolean}) => {
    this._replaceWordAtCursor(`@${u} `)
    this.props.setMentionPopupOpen(false)

    // This happens if you type @notausername<enter>. We've essentially 'picked' nothing and really want to submit
    // This is a little wonky cause this component doesn't directly know if the list is filtered all the way out
    if (options && options.notUser) {
      if (this.props.text) {
        this.props.onPostMessage(this.props.text)
        this.props.setText('')
      }
    }
  }

  _switchMention = (u: string) => {
    this._replaceWordAtCursor(`@${u}`)
  }

  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        {this.props.mentionPopupOpen &&
          <MentionCatcher onClick={() => this.props.setMentionPopupOpen(false)} />}
        {this.props.mentionPopupOpen &&
          <MentionHud
            selectDownCounter={this.state.downArrowCounter}
            selectUpCounter={this.state.upArrowCounter}
            pickSelectedUserCounter={this.state.pickSelectedCounter}
            onPickUser={this._insertMention}
            onSelectUser={this._switchMention}
            filter={this.props.mentionFilter}
          />}
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <input
            type="file"
            style={{display: 'none'}}
            ref={this.props.filePickerSetRef}
            onChange={this._pickFile}
            multiple={true}
          />
          <Input
            className={'mousetrap' /* className needed so key handler doesn't ignore hotkeys */}
            autoFocus={false}
            small={true}
            style={styleInput}
            ref={r => this._inputSetRef(r)}
            hintText="Write a message"
            hideUnderline={true}
            onChangeText={this.props.setText}
            value={this.props.text}
            multiline={true}
            rowsMin={1}
            rowsMax={5}
            onKeyDown={this._onKeyDown}
            onKeyUp={this._onKeyUp}
            onEnterKeyDown={this._onEnterKeyDown}
          />
          {this.props.emojiPickerOpen &&
            <EmojiPicker emojiPickerToggle={this.props.emojiPickerToggle} onClick={this._pickerOnClick} />}
          <Icon onClick={this.props.emojiPickerToggle} style={styleIcon} type="iconfont-emoji" />
          <Icon onClick={this.props.filePickerOpen} style={styleIcon} type="iconfont-attachment" />
        </Box>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
          <Text
            type="BodySmall"
            style={{
              flexGrow: 1,
              marginBottom: globalMargins.xtiny,
              marginLeft: globalMargins.tiny,
              textAlign: 'left',
            }}
          >
            {isTyping(this.props.typing)}
          </Text>
          <Text type="BodySmall" style={{...styleFooter, textAlign: 'right'}} onClick={this.props.inputFocus}>
            *bold*, _italics_, `code`, >quote
          </Text>
        </Box>
      </Box>
    )
  }
}

const isTyping = typing => {
  if (!typing || !typing.length) {
    return ''
  }
  switch (typing.length) {
    case 1:
      return [<Text key={0} type="BodySmallSemibold">{typing[0]}</Text>, ` is typing`]
    case 2:
      return [
        <Text key={0} type="BodySmallSemibold">{typing[0]}</Text>,
        ` and `,
        <Text key={1} type="BodySmallSemibold">{typing[1]}</Text>,
        ` are typing`,
      ]
    default:
      return [<Text key={0} type="BodySmallSemibold">{typing.join(', ')}</Text>, ` are typing`]
  }
}

const InputAccessory = Component => props => (
  <Box style={{position: 'relative', width: '100%'}}>
    <Box
      style={{
        bottom: 1,
        display: 'flex',
        left: 0,
        position: 'absolute',
        right: 0,
      }}
    >
      <Component {...props} />
    </Box>
  </Box>
)

const MentionHud = InputAccessory(props => (
  <ConnectedMentionHud
    style={{
      borderRadius: 4,
      boxShadow: '0 0 8px 0 rgba(0, 0, 0, 0.2)',
      height: 220,
      marginLeft: 20,
      marginRight: 20,
      width: '100%',
    }}
    {...props}
  />
))

const EmojiPicker = ({emojiPickerToggle, onClick}) => (
  <Box>
    <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0, top: 0}} onClick={emojiPickerToggle} />
    <Box style={{position: 'relative'}}>
      <Box style={{bottom: 0, position: 'absolute', right: 0}}>
        <Picker onClick={onClick} emoji={'ghost'} title={'emojibase'} backgroundImageFn={backgroundImageFn} />
      </Box>
    </Box>
  </Box>
)

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  marginTop: globalMargins.tiny,
  textAlign: 'left',
}

const styleIcon = {
  paddingRight: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}

const styleFooter = {
  color: globalColors.black_20,
  cursor: 'text',
  marginBottom: globalMargins.xtiny,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  marginTop: 0,
  textAlign: 'right',
}

export default compose(
  withState('emojiPickerOpen', 'setEmojiPickerOpen', false),
  withHandlers(props => {
    let fileInput
    return {
      emojiPickerToggle: ({emojiPickerOpen, setEmojiPickerOpen}) => () =>
        setEmojiPickerOpen(!emojiPickerOpen),
      filePickerFiles: props => () => (fileInput && fileInput.files) || [],
      filePickerOpen: props => () => {
        fileInput && fileInput.click()
      },
      filePickerSetRef: props => (r: any) => {
        fileInput = r
      },
      filePickerSetValue: props => (value: any) => {
        if (fileInput) fileInput.value = value
      },
    }
  })
)(ConversationInput)
