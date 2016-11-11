// @flow
// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import React, {Component} from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.native'
import {NativeTextInput} from './index.native'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './input'

type State = {
  value: string,
  focused: boolean,
}

class Input extends Component<void, Props, State> {
  state: State;
  _input: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      value: props.value || '',
      focused: false,
    }
  }

  componentDidMount () {
    this._autoResize()
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.hasOwnProperty('value')) {
      this.setState({value: nextProps.value || ''})
      this._autoResize()
    }
  }

  componentWillUpdate (nextProps: Props) {
    if (nextProps.type !== this.props.type) {
      this._setPasswordVisible(nextProps.type === 'passwordVisible')
    }
  }

  _autoResize () {
    // maybe support this later. Keeping this flow so it matches desktop
  }

  _setPasswordVisible (passwordVisible: boolean) {
    // $FlowIssue
    this._textInput && this._textInput.setNativeProps({passwordVisible})
  }

  getValue (): string {
    return this.state.value || ''
  }

  setValue (value: string) {
    this.setState({value: value || ''})
  }

  clearValue () {
    this._onChangeText('')
  }

  _onChangeText = (text: string) => {
    this.setState({value: text || ''})
    this._autoResize()

    this.props.onChangeText && this.props.onChangeText(text || '')
  }

  _inputNode () {
    return this._input
  }

  focus () {
    this._input && this._inputNode().focus()
  }

  select () {
    this._input && this._inputNode().select()
  }

  blur () {
    this._input && this._inputNode().blur()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent) => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e)
    }

    if (this.props.onEnterKeyDown && e.key === 'Enter') {
      this.props.onEnterKeyDown(e)
    }
  }

  _onFocus = () => {
    this.setState({focused: true})
  }

  _onBlur = () => {
    this.setState({focused: false})
  }

  _underlineColor () {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10
  }

  _rowsToHeight (rows) {
    return rows * _lineHeight +
      1 // border
  }

  _containerStyle (underlineColor) {
    return this.props.small
    ? {
      ...globalStyles.flexBoxRow,
      borderBottomWidth: 1,
      borderBottomColor: underlineColor,
      flex: 1,
    }
    : {
      ...globalStyles.flexBoxColumn,
      justifyContent: 'flex-start',
      maxWidth: 460,
    }
  }

  render () {
    const underlineColor = this._underlineColor()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      lineHeight: _lineHeight,
      backgroundColor: globalColors.transparent,
      flex: 1,
      borderWidth: 0,
      ...(this.props.small
      ? {textAlign: 'left'}
      : {
        textAlign: 'center',
        minWidth: 333,
      }),
    }

    const singlelineStyle = {
      ...commonInputStyle,
      height: 28,
      padding: 0,
    }

    const multilineStyle = {
      ...commonInputStyle,
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : null),
    }

    const floatingHintText = !!this.state.value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
       ? this.props.floatingHintTextOverride
       : this.props.hintText || ' ')

    const commonProps = {
      autoCorrect: this.props.hasOwnProperty('autoCorrect') && this.props.autoCorrect,
      autoCapitalize: this.props.autoCapitalize || 'none',
      keyboardType: this.props.keyboardType,
      autoFocus: this.props.autoFocus,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onFocus: this._onFocus,
      onKeyDown: this._onKeyDown,
      placeholder: this.props.hintText,
      ref: r => { this._input = r },
      returnKeyType: this.props.returnKeyType,
      value: this.state.value,
      secureTextEntry: this.props.type === 'password',
      underlineColorAndroid: globalColors.transparent,
    }

    const singlelineProps = {
      ...commonProps,
      multiline: false,
      style: {...singlelineStyle, ...this.props.inputStyle},
      type: {
        password: 'password',
        text: 'text',
        passwordVisible: 'text',
      }[this.props.type || 'text'] || 'text',
    }

    const multilineProps = {
      ...commonProps,
      multiline: true,
      style: {...multilineStyle, ...this.props.inputStyle},
    }

    const smallLabelStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      lineHeight: _lineHeight,
      marginRight: 8,
      color: globalColors.blue,
      ...this.props.smallLabelStyle,
    }

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        {!this.props.small && <Text type='BodySmall' style={_floatingStyle}>{floatingHintText}</Text>}
        {!!this.props.small && !!this.props.smallLabel && <Text type='BodySmall' style={smallLabelStyle}>{this.props.smallLabel}</Text>}
        <Box style={this.props.small ? {flex: 1} : {borderBottomWidth: 1, borderBottomColor: underlineColor}}>
          <NativeTextInput {...(this.props.multiline ? multilineProps : singlelineProps)} />
        </Box>
        {!!this.props.errorText && !this.props.small && <Text type='BodyError' style={{..._errorStyle, ...this.props.errorStyle}}>{this.props.errorText}</Text>}
      </Box>
    )
  }
}

const _lineHeight = 28
const _headerTextStyle = getTextStyle('Header')
const _bodySmallTextStyle = getTextStyle('BodySmall')

const _errorStyle = {
  textAlign: 'center',
}

const _floatingStyle = {
  textAlign: 'center',
  minHeight: _bodySmallTextStyle.lineHeight,
  color: globalColors.blue,
  marginBottom: 9,
}

export default Input
