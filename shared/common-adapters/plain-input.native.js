// @flow
import React, {Component} from 'react'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import {collapseStyles, globalColors, styleSheetCreate} from '../styles'
import {isIOS} from '../constants/platform'

import {type StylesCrossPlatform} from '../styles'
import type {TextType} from './text'

export type KeyboardType =
  | 'default'
  | 'email-address'
  | 'numeric'
  | 'phone-pad'
  // iOS only
  | 'ascii-capable'
  | 'numbers-and-punctuation'
  | 'url'
  | 'number-pad'
  | 'name-phone-pad'
  | 'decimal-pad'
  | 'twitter'
  | 'web-search'
  // Android Only
  | 'visible-password'

export type Props = {
  autoFocus?: boolean,
  className?: string,
  disabled?: boolean,
  // Resize in a flexbox-like fashion
  flexable?: boolean,
  maxLength?: number,
  multiline?: boolean,
  onBlur?: () => void,
  onChangeText?: (text: string) => void,
  onFocus?: () => void,
  placeholder?: string,
  rowsMin?: number,
  rowsMax?: number,
  style?: StylesCrossPlatform,
  textType?: TextType,
  type?: 'password' | 'text' | 'number',

  /* Platform discrepancies */
  // Maps to onSubmitEditing on native
  onEnterKeyDown?: () => void,

  // Desktop only
  onClick?: (event: Event) => void,
  onKeyDown?: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
  onKeyUp?: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,

  // Mobile only
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters',
  autoCorrect?: boolean,
  keyboardType?: KeyboardType,
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send',
  selectTextOnFocus?: boolean,
  onEndEditing?: () => void,
}

// Use this to mix your props with input props like type Props = PropsWithInput<{foo: number}>
export type PropsWithInput<P> = {|
  ...$Exact<Props>,
  ...$Exact<P>,
|}

/**
 * Flow does the work of making the default props nullable when instantiating
 * this component, but doesn't go as far as letting the props be
 * actually nullable in the type def. This complicates things when trying
 * to make this compatible with PropsWithInput. So here we split up the
 * internal type of Props from the public API, and 'lie' in this file
 * by claiming that this component takes `Props` when the implementations
 * use `InternalProps`.
 * See more discussion here: https://github.com/facebook/flow/issues/1660
 */
export type DefaultProps = {
  keyboardType: KeyboardType,
  textType: TextType,
}
export type InternalProps = DefaultProps & Props

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
      this.props.multiline ? this._getMultilineStyle() : this._getSinglelineStyle(),
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
