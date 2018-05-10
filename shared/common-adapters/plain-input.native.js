// @flow
import React, {Component} from 'react'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {collapseStyles, globalColors} from '../styles'
import {isIOS} from '../constants/platform'

import type {Props, Selection, TextInfo} from './plain-input'
import {checkTextInfo} from './plain-input.shared'

const defaultTextType = 'Body'

type State = {
  focused: boolean,
  height: ?number,
  value: string,
}

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling
class _PlainInput extends Component<PropsWithTimer<Props>, State> {
  state: State
  _input: NativeTextInput | null
  _lastNativeSelection: ?{start: number, end: number}

  constructor(props: PropsWithTimer<Props>) {
    super(props)

    const value = props.value || ''
    this.state = ({
      focused: false,
      height: null,
      value,
    }: State)
  }

  _setInputRef = (ref: NativeTextInput | null) => {
    this._input = ref
  }

  // Does nothing on mobile
  select = () => {}

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: Object) => {
    this._input && this._input.setNativeProps(nativeProps)
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    if (nextProps.value === prevState.value) {
      return
    }
    return {value: nextProps.value || ''}
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

  getValue = (): string => {
    return this.state.value || ''
  }

  selection = (): Selection => {
    return this._lastNativeSelection || {start: 0, end: 0}
  }

  _onChangeTextDone = () => {
    const value = this.getValue()
    this.props.onChangeText && this.props.onChangeText(value)
  }

  _onChangeText = (text: string) => {
    this.setState({value: text}, this._onChangeTextDone)
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  transformText = (fn: TextInfo => TextInfo) => {
    const textInfo: TextInfo = {
      text: this.getValue(),
      selection: this.selection(),
    }
    const newTextInfo = fn(textInfo)
    checkTextInfo(newTextInfo)
    this.setNativeProps({text: newTextInfo.text})
    // Setting both the text and the selection at the same time
    // doesn't seem to work, but setting a short timeout to set the
    // selection does.
    this.props.setTimeout(() => {
      // It's possible that, by the time this runs, the selection is
      // out of bounds with respect to the current text value. So fix
      // it up if necessary.
      const text = this.getValue()
      let {start, end} = newTextInfo.selection
      end = Math.max(0, Math.min(end, text.length))
      start = Math.max(0, Math.min(start, end))
      const selection = {start, end}
      this.setNativeProps({selection})
      this._lastNativeSelection = selection
    }, 0)
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  _onSelectionChange = (event: {nativeEvent: {selection: {start: number, end: number}}}) => {
    let {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start, _end)
    const end = Math.max(_start, _end)
    this._lastNativeSelection = {start, end}
    // Bit of a hack here: Unlike the desktop case, where the text and
    // selection are updated simultaneously, on mobile the text gets
    // updated first, so handlers that rely on an updated selection
    // will get strange results. So trigger a text change notification
    // when the selection changes.
    this._onChangeTextDone()
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

    const value = this.getValue()

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
      onChangeText: this._onChangeText,
      onFocus: this._onFocus,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this.props.onSubmitEditing,
      onEndEditing: this.props.onEndEditing,
      placeholder: this.props.placeholder,
      ref: this._setInputRef,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      underlineColorAndroid: 'transparent',
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    if (this.props.value) {
      commonProps.value = value
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
