// @flow
// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import React, {Component} from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.native'
import {NativeTextInput} from './index.native'
import {globalStyles, globalColors} from '../styles'
import {isIOS} from '../constants/platform'

import type {Props} from './input'

type State = {
  focused: boolean,
  height: ?number,
  value: string,
}

class Input extends Component<void, Props, State> {
  state: State
  _input: any

  constructor(props: Props) {
    super(props)

    this.state = {
      focused: false,
      height: null,
      value: props.value || '',
    }
  }

  setNativeProps(props: Object) {
    this._input && this._input.setNativeProps(props)
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.hasOwnProperty('value')) {
      this.setState({value: nextProps.value || ''})
    }
  }

  componentWillUpdate(nextProps: Props) {
    if (nextProps.type !== this.props.type) {
      this._setPasswordVisible(nextProps.type === 'passwordVisible')
    }
  }

  _onContentSizeChange = event => {
    if (
      this.props.multiline &&
      event &&
      event.nativeEvent &&
      event.nativeEvent.contentSize &&
      event.nativeEvent.contentSize.height
    ) {
      let height = event.nativeEvent.contentSize.height
      const minHeight = this.props.rowsMin && this._rowsToHeight(this.props.rowsMin)
      const maxHeight = this.props.rowsMax && this._rowsToHeight(this.props.rowsMax)
      if (minHeight && height < minHeight) {
        height = minHeight
      } else if (maxHeight && height > maxHeight) {
        height = maxHeight
      }

      if (height !== this.state.height) {
        this.setState({height})
      }
    }
  }

  _setPasswordVisible(passwordVisible: boolean) {
    // $FlowIssue
    this._textInput && this._textInput.setNativeProps({passwordVisible})
  }

  getValue(): string {
    return this.state.value || ''
  }

  setValue(value: string) {
    this.setState({value: value || ''})
  }

  clearValue() {
    this._onChangeText('')
  }

  _onChangeText = (text: string) => {
    this.setState({value: text || ''})

    this.props.onChangeText && this.props.onChangeText(text || '')
  }

  _inputNode() {
    return this._input
  }

  focus() {
    this._input && this._inputNode().focus()
  }

  select() {
    this._input && this._inputNode().select()
  }

  blur() {
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
    this.props.onBlur && this.props.onBlur()
  }

  _underlineColor() {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10
  }

  _rowsToHeight(rows) {
    return rows * _lineHeight + 1 // border
  }

  _containerStyle(underlineColor) {
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
          maxWidth: 400,
        }
  }

  render() {
    const underlineColor = this._underlineColor()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      lineHeight: _lineHeight,
      backgroundColor: globalColors.transparent,
      flexGrow: 1,
      borderWidth: 0,
      ...(this.props.small
        ? {textAlign: 'left'}
        : {
            textAlign: 'center',
            minWidth: 200,
          }),
    }

    const singlelineStyle = {
      ...commonInputStyle,
      maxHeight: _lineHeight, // ensure it doesn't grow or shrink
      minHeight: _lineHeight,
      padding: 0,
    }

    const multilineStyle = {
      ...commonInputStyle,
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : null),
    }

    // Override height if we received an onContentSizeChange() earlier.
    if (isIOS && this.state.height) {
      multilineStyle.height = this.state.height
    }

    const floatingHintText =
      !!this.state.value.length &&
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
      onSubmitEditing: this.props.onEnterKeyDown,
      onEndEditing: this.props.onEndEditing,
      placeholder: this.props.hintText,
      ref: r => {
        this._input = r
      },
      returnKeyType: this.props.returnKeyType,
      value: this.state.value,
      secureTextEntry: this.props.type === 'password',
      underlineColorAndroid: globalColors.transparent,
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
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
      onContentSizeChange: isIOS ? this._onContentSizeChange : null,
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
        {!this.props.small && <Text type="BodySmall" style={_floatingStyle}>{floatingHintText}</Text>}
        {!!this.props.small &&
          !!this.props.smallLabel &&
          <Text type="BodySmall" style={smallLabelStyle}>{this.props.smallLabel}</Text>}
        <Box style={this.props.small ? {flex: 1} : {borderBottomWidth: 1, borderBottomColor: underlineColor}}>
          <NativeTextInput {...(this.props.multiline ? multilineProps : singlelineProps)} />
        </Box>
        {!this.props.small &&
          <Text type="BodyError" style={{..._errorStyle, ...this.props.errorStyle}}>
            {this.props.errorText || ''}
          </Text>}
      </Box>
    )
  }
}

const _lineHeight = 28
const _headerTextStyle = getTextStyle('Header')
const _bodySmallTextStyle = getTextStyle('BodySmall')
const _bodyErrorTextStyle = getTextStyle('BodyError')

const _errorStyle = {
  minHeight: _bodyErrorTextStyle.lineHeight,
  textAlign: 'center',
}

const _floatingStyle = {
  textAlign: 'center',
  minHeight: _bodySmallTextStyle.lineHeight,
  color: globalColors.blue,
  marginBottom: 9,
}

export default Input
