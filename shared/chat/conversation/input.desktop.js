// @flow
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {Picker} from 'emoji-mart'

import type {Props} from './'

type State = {
  emojiPickerOpen: boolean,
  inputText: ?string,
}

class Conversation extends Component<void, Props, State> {
  _input: any;
  state: State;

  _setRef = r => {
    this._input = r
  }

  constructor (props: Props) {
    super(props)
    const {emojiPickerOpen} = props
    this.state = {emojiPickerOpen, inputText: null}
  }

  _insertEmoji (emojiColons: string) {
    const inputText = this.state.inputText || ''
    if (this._input) {
      const {selectionStart = 0, selectionEnd = 0} = this._input.selections() || {}
      const nextInputText = [inputText.substring(0, selectionStart), emojiColons, inputText.substring(selectionEnd)].join('')
      this.setState({inputText: nextInputText})
    }
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}}>
          <Input
            small={true}
            style={styleInput}
            ref={this._setRef}
            hintText={`Write to ${this.props.participants.filter(p => !p.you).map(p => p.username).join(', ')}`}
            hideUnderline={false}
            onChangeText={inputText => this.setState({inputText})}
            value={this.state.inputText}
            multiline={true}
            rowsMin={1}
            onEnterKeyDown={() => {
              if (this.state.inputText) {
                this.props.onPostMessage(this.state.inputText)
                this._input.clearValue()
              }
            }}
          />
          {this.state.emojiPickerOpen && (
            <Box>
              <Box style={{position: 'absolute', right: 0, bottom: 0, top: 0, left: 0}} onClick={() => this.setState({emojiPickerOpen: false})} />
              <Box style={{position: 'relative'}}>
                <Box style={{position: 'absolute', right: 0, bottom: 0}}>
                  <Picker onClick={emoji => this._insertEmoji(emoji.colons)} emoji={'ghost'} title={'emojibase'} />
                </Box>
              </Box>
            </Box>
          )}
          <Icon onClick={() => this.setState({emojiPickerOpen: !this.state.emojiPickerOpen})} style={styleIcon} type='iconfont-emoji' />
          <Icon onClick={() => console.log('attachment callback')} style={styleIcon} type='iconfont-attachment' />
        </Box>
        <Text type='BodySmall' style={styleFooter}>*bold*, _italics_, `code`, >quote</Text>
      </Box>
    )
  }
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  textAlign: 'left',
}

const styleIcon = {
  paddingTop: globalMargins.xtiny,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
}

const styleFooter = {
  flex: 1,
  color: globalColors.black_20,
  textAlign: 'right',
  marginTop: 0,
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

export default Conversation
