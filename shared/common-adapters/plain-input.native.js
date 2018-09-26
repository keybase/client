// @flow
import React, {Component} from 'react'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import {collapseStyles, globalColors, styleSheetCreate} from '../styles'
import {isIOS} from '../constants/platform'
import {checkTextInfo} from './input.shared'
import {pick} from 'lodash-es'
import logger from '../logger'

import type {InternalProps, TextInfo, Selection} from './plain-input'

type ContentSizeChangeEvent = {nativeEvent: {contentSize: {width: number, height: number}}}

type State = {
  focused: boolean,
  height: ?number,
}

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends Component<InternalProps, State> {
  static defaultProps = {
    keyboardType: 'default',
    textType: 'Body',
  }

  state: State = {
    focused: false,
    height: null,
  }
  _input: ?NativeTextInput
  _lastNativeText: ?string
  _lastNativeSelection: ?Selection

  // TODO remove this when we can use forwardRef with react-redux. That'd let us
  // use HOCTimers with this component.
  // https://github.com/reduxjs/react-redux/pull/1000
  _timeoutIDs = []

  _setInputRef = (ref: ?NativeTextInput) => {
    this._input = ref
  }

  _setTimeout = (fn: () => void, timeoutMS: number) => {
    this._timeoutIDs.push(setTimeout(fn, timeoutMS))
  }

  // This is controlled if a value prop is passed
  _controlled = () => typeof this.props.value === 'string'

  componentWillUnmount() {
    this._timeoutIDs.forEach(clearTimeout)
  }

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: Object) => {
    this._input && this._input.setNativeProps(nativeProps)
  }

  transformText = (fn: TextInfo => TextInfo) => {
    if (this._controlled()) {
      const errMsg =
        'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const currentTextInfo = {
      text: this._lastNativeText || '',
      selection: this._lastNativeSelection || {start: 0, end: 0},
    }
    const newTextInfo = fn(currentTextInfo)
    checkTextInfo(newTextInfo)
    this.setNativeProps({text: newTextInfo.text})
    this._lastNativeText = newTextInfo.text
    this._setSelection(newTextInfo.selection)
  }

  getSelection = () => this._lastNativeSelection || {start: 0, end: 0}

  setSelection = (s: Selection) => {
    if (!this._controlled()) {
      const errMsg =
        'Attempted to use setSelection on uncontrolled input component. Use transformText instead'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    this._setSelection(s)
  }

  _setSelection = (selection: Selection) => {
    this._setTimeout(() => {
      // Validate that this selection makes sense with current value
      let {start, end} = selection
      const text = this._lastNativeText || '' // TODO write a good internal getValue fcn for this
      end = Math.max(0, Math.min(end, text.length))
      start = Math.min(start, end)
      const newSelection = {start, end}
      this.setNativeProps({selection: newSelection})
      this._lastNativeSelection = selection
    }, 0)
  }

  _onChangeText = (t: string) => {
    this._lastNativeText = t
    this.props.onChangeText && this.props.onChangeText(t)
  }

  _onSelectionChange = (event: {nativeEvent: {selection: Selection}}) => {
    const {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start, _end)
    const end = Math.max(_start, _end)
    this._lastNativeSelection = {start, end}
  }

  _onContentSizeChange = (event: ContentSizeChangeEvent) => {
    if (this.props.multiline) {
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
    const textStyle = getTextStyle(this.props.textType)
    return textStyle.lineHeight
  }

  _fontSize = () => {
    const textStyle = getTextStyle(this.props.textType)
    return textStyle.fontSize
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  _getCommonStyle = () => {
    const textStyle = getTextStyle(this.props.textType)
    return collapseStyles([{lineHeight: this._lineHeight()}, styles.common, textStyle])
  }

  _getMultilineStyle = () => {
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const lineHeight = this._lineHeight()
    return collapseStyles([
      styles.multiline,
      {
        minHeight: (this.props.rowsMin || defaultRowsToShow) * lineHeight,
      },
      !!this.props.rowsMax && {maxHeight: this.props.rowsMax * lineHeight},
      isIOS && !!this.state.height && {height: this.state.height},
    ])
  }

  _getSinglelineStyle = () => {
    const lineHeight = this._lineHeight()
    return collapseStyles([styles.singleline, {minHeight: lineHeight, maxHeight: lineHeight}])
  }

  _getStyle = () => {
    return collapseStyles([
      this._getCommonStyle(),
      this.props.multiline ? this._getMultilineStyle() : this._getSinglelineStyle(),
      this.props.style,
    ])
  }

  _getProps = () => {
    const common = {
      ...pick(this.props, ['maxLength', 'value']), // Props we should only passthrough if supplied
      autoCapitalize: this.props.autoCapitalize || 'none',
      autoCorrect: !!this.props.autoCorrect,
      autoFocus: this.props.autoFocus,
      editable: !this.props.disabled,
      keyboardType: this.props.keyboardType,
      multiline: false,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this._onFocus,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this.props.onEnterKeyDown,
      placeholder: this.props.placeholder,
      placeholderTextColor: this.props.placeholderColor || globalColors.black_40,
      ref: this._setInputRef,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      style: this._getStyle(),
      underlineColorAndroid: 'transparent',
    }
    if (this.props.multiline) {
      return {
        ...common,
        blurOnSubmit: false,
        multiline: true,
        onContentSizeChange: this._onContentSizeChange,
      }
    }
    return common
  }

  render = () => {
    const props = this._getProps()
    if (props.value) {
      this._lastNativeText = props.value
    }
    return <NativeTextInput {...props} />
  }
}

const styles = styleSheetCreate({
  common: {backgroundColor: globalColors.fastBlank, flexGrow: 1, borderWidth: 0},
  multiline: {
    height: undefined,
    // TODO: Maybe remove these paddings?
    paddingBottom: 0,
    paddingTop: 0,
  },
  singleline: {padding: 0},
})

export default PlainInput
