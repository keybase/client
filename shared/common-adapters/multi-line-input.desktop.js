// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, transition} from '../styles/style-guide'
import Text from './text'
import type {Props} from './multi-line-input'

type State = {textContent: string}

export default class MultiLineInput extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {textContent: ''}
  }

  _handleKeyUp (e: SyntheticEvent) {
    // $FlowIssue
    this.setState({textContent: e.target.textContent})
    // This is a content editable text, not input.
    // People using onChange may expect text to be in target.value
    // but on content editable it is in target.textContent
    // Copy this to provide a uniform api
    // $FlowIssue
    e.target.value = e.target.textContent
    this.props.onChange && this.props.onChange(e)
  }

  _handleKeyDown (e: any) {
    // Check enter
    if (e.keyCode === 13 && this.props.onEnterKeyDown) {
      this.props.onEnterKeyDown(e)
    }
  }

  _focusTextBox () {
    if (this.refs && this.refs.textBox) {
      this.refs.textBox.focus()
    }
  }

  render () {
    return (
      <div style={{...containerStyle, ...this.props.style}}>
        <Text
          style={{...hintTextStyle, ...(this.state.textContent.length > 0 ? {opacity: 0} : {opacity: 1})}}
          onClick={() => this._focusTextBox()} type='HeaderBig'>{this.props.hintText}</Text>
        <Text style={inputStyle}
          contentEditable
          autoComplete='off'
          ref='textBox'
          onKeyUp={e => this._handleKeyUp(e)}
          onKeyDown={e => this._handleKeyDown(e)}
          type='HeaderBig'>type</Text>
        {this.props.errorText && <Text style={errorTextStyle} type='Error'>{this.props.errorText}</Text>}
        <div style={underlineStyle}></div>
      </div>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  justifyContent: 'flex-end',
}

const hintTextStyle = {
  ...transition('opacity'),
  cursor: 'text',
  color: globalColors.black_10,
  textAlign: 'center',
}

const inputStyle = {
  position: 'absolute',
  bottom: 2, // To align it perfectly with the hintText
  left: 0,
  right: 0,
  outline: 'none',
  textAlign: 'center',
}

const underlineStyle = {
  border: 'solid',
  borderWidth: 1,
  borderColor: 'rgba(0, 0, 0, 0.08)',
}

const errorTextStyle = {
  position: 'absolute',
  bottom: -18,
  left: 0,
  right: 0,
  outline: 'none',
  textAlign: 'center',
}
