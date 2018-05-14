// @flow
import React, {Component} from 'react'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {collapseStyles, globalColors} from '../styles'
import {isIOS} from '../constants/platform'

import type {Props} from './plain-input'

const defaultTextType = 'Body'

type State = {
  focused: boolean,
  height: ?number,
}

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling
class _PlainInput extends Component<PropsWithTimer<Props>, State> {
  state: State
  _input: NativeTextInput | null

  constructor(props: PropsWithTimer<Props>) {
    super(props)

    this.state = ({
      focused: false,
      height: null,
    }: State)
  }

  _setInputRef = (ref: NativeTextInput | null) => {
    this._input = ref
  }

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: Object) => {
    this._input && this._input.setNativeProps(nativeProps)
  }

  _onContentSizeChange = event => {
    if (
      this.props.multiline &&
      event &&
      event.nativeEvent &&
      event.nativeEvent.contentSize &&
      event.nativeEvent.contentSize.height &&
      event.nativeEvent.contentSize.width
    ) {
      let height = event.nativeEvent.contentSize.height
      const minHeight = this.props.rowsMin && this.props.rowsMin * this._lineHeight()
      const maxHeight = this.props.rowsMax && this.props.rowsMax * this._lineHeight()
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

  _lineHeight = () => {
    const textStyle = getTextStyle(this.props.textType || defaultTextType)
    return textStyle.lineHeight
  }

  _fontSize = () => {
    const textStyle = getTextStyle(this.props.textType || defaultTextType)
    return textStyle.fontSize
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  setValue = (text: string) => {
    this.setNativeProps({text})
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  render = () => {
    const textStyle = getTextStyle(this.props.textType || 'Body')
    const lineHeight = this._lineHeight()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)

    const commonInputStyle = {
      lineHeight: lineHeight,
      backgroundColor: globalColors.fastBlank,
      flexGrow: 1,
      borderWidth: 0,
      ...textStyle,
    }

    const singlelineStyle = {
      ...commonInputStyle,
      maxHeight: lineHeight, // ensure it doesn't grow or shrink
      minHeight: lineHeight,
      padding: 0,
    }

    const multilineStyle = {
      ...commonInputStyle,
      height: undefined,
      minHeight: (this.props.rowsMin || defaultRowsToShow) * this._lineHeight(),
      paddingBottom: 0,
      paddingTop: 0,
      ...(this.props.rowsMax ? {maxHeight: this.props.rowsMax * lineHeight} : null),
    }

    // Override height if we received an onContentSizeChange() earlier.
    if (isIOS && this.state.height) {
      multilineStyle.height = this.state.height
    }

    const keyboardType = this.props.keyboardType || 'default'

    // We want to be able to set the selection property,
    // too. Unfortunately, that triggers an Android crash:
    // https://github.com/facebook/react-native/issues/18316 .
    const commonProps: {value?: string} = {
      autoCorrect: this.props.hasOwnProperty('autoCorrect') && this.props.autoCorrect,
      autoCapitalize: this.props.autoCapitalize || 'none',
      editable: !this.props.disabled,
      keyboardType,
      autoFocus: this.props.autoFocus,
      onBlur: this._onBlur,
      onChangeText: this.props.onChangeText,
      onFocus: this._onFocus,
      onSubmitEditing: this.props.onEnterKeyDown,
      onEndEditing: this.props.onEndEditing,
      placeholder: this.props.placeholder,
      ref: this._setInputRef,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      underlineColorAndroid: 'transparent',
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    const singlelineProps = {
      ...commonProps,
      multiline: false,
      style: collapseStyles([singlelineStyle, this.props.style]),
    }

    const multilineProps = {
      ...commonProps,
      multiline: true,
      blurOnSubmit: false,
      onContentSizeChange: this._onContentSizeChange,
      style: collapseStyles([multilineStyle, this.props.style]),
      ...(this.props.rowsMax ? {maxHeight: this.props.rowsMax * this._lineHeight()} : {}),
    }

    return <NativeTextInput {...(this.props.multiline ? multilineProps : singlelineProps)} />
  }
}
const PlainInput = HOCTimers(_PlainInput)

export default PlainInput
