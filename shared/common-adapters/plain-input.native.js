// @flow
import React, {Component} from 'react'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import {collapseStyles, globalColors, styleSheetCreate} from '../styles'
import {isIOS} from '../constants/platform'

import type {InternalProps} from './plain-input'

type ContentSizeChangeEvent = {nativeEvent: {contentSize: {width: number, height: number}}}

type State = {
  focused: boolean,
  height: ?number,
}

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling
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
  _setInputRef = (ref: ?NativeTextInput) => {
    this._input = ref
  }

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: Object) => {
    this._input && this._input.setNativeProps(nativeProps)
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
      this.props.multiline && this._getMultilineStyle(),
      !this.props.multiline && this._getSinglelineStyle(),
      this.props.style,
    ])
  }

  _getProps = () => {
    const common: any = {
      autoCapitalize: this.props.autoCapitalize || 'none',
      autoCorrect: !!this.props.autoCorrect,
      autoFocus: this.props.autoFocus,
      editable: !this.props.disabled,
      keyboardType: this.props.keyboardType,
      multiline: false,
      onBlur: this._onBlur,
      onChangeText: this.props.onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this._onFocus,
      onSubmitEditing: this.props.onEnterKeyDown,
      placeholder: this.props.placeholder,
      ref: this._setInputRef,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      style: this._getStyle(),
      underlineColorAndroid: 'transparent',
    }
    if (this.props.maxLength) {
      common.maxLength = this.props.maxLength
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
    return <NativeTextInput {...props} />
  }
}

const styles = styleSheetCreate({
  common: {backgroundColor: globalColors.fastBlank, flexGrow: 1, borderWidth: 0},
  multiline: {
    height: undefined,
    paddingBottom: 0,
    paddingTop: 0,
  },
  singleline: {padding: 0},
})

export default PlainInput
