import React, {Component} from 'react'
import {TextInput} from 'react-native'
import {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  padding,
  platformStyles,
  styleSheetCreate,
  isDarkMode,
} from '../styles'
import {isIOS} from '../constants/platform'
import {checkTextInfo} from './input.shared'
import pick from 'lodash/pick'
import logger from '../logger'
import ClickableBox from './clickable-box'
import {Box2} from './box'

import {InternalProps, TextInfo, Selection} from './plain-input'

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends Component<InternalProps> {
  static defaultProps = {
    keyboardType: 'default',
    textType: 'Body',
  }

  _input = React.createRef<TextInput>()
  _lastNativeText: string | null = null
  _lastNativeSelection: Selection | null = null
  _timeoutIDs: Array<ReturnType<typeof setInterval>> = []

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
    this._input.current && this._input.current.setNativeProps(nativeProps)
  }

  transformText = (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean) => {
    if (this._controlled()) {
      const errMsg =
        'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const currentTextInfo = {
      selection: this._lastNativeSelection || {end: 0, start: 0},
      text: this._lastNativeText || '',
    }
    const newTextInfo = fn(currentTextInfo)
    const newCheckedSelection = this._sanityCheckSelection(newTextInfo.selection, newTextInfo.text)
    checkTextInfo(newTextInfo)
    if (isIOS) {
      this.setNativeProps({text: newTextInfo.text})
      // hacky workaround to RN input crappiness, otherwise leaves the selection randomly inside
      setTimeout(() => {
        this.setNativeProps({selection: newCheckedSelection})
      }, 1)
    } else {
      this.setNativeProps({text: newTextInfo.text})
      this.setNativeProps({selection: newCheckedSelection})
    }
    this._lastNativeText = newTextInfo.text
    this._lastNativeSelection = newCheckedSelection
    if (reflectChange) {
      this._onChangeText(newTextInfo.text)
    }
  }

  getSelection = () => this._lastNativeSelection || {end: 0, start: 0}

  setSelection = (s: Selection) => {
    if (!this._controlled()) {
      const errMsg =
        'Attempted to use setSelection on uncontrolled input component. Use transformText instead'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    this._setSelection(s)
  }

  // Validate that this selection makes sense with current value
  _sanityCheckSelection = (selection: Selection, nativeText: string): Selection => {
    let {start, end} = selection
    end = Math.max(0, Math.min(end || 0, nativeText.length))
    start = Math.min(start || 0, end)
    return {end, start}
  }

  _setSelection = (selection: Selection) => {
    this._setTimeout(() => {
      const newSelection = this._sanityCheckSelection(selection, this._lastNativeText || '')
      this.setNativeProps({selection: newSelection})
      this._lastNativeSelection = selection
    }, 0)
  }

  _onChangeText = (t: string) => {
    if (this.props.maxBytes) {
      const {maxBytes} = this.props
      if (Buffer.byteLength(t) > maxBytes) {
        return
      }
    }
    this._lastNativeText = t
    this.props.onChangeText && this.props.onChangeText(t)
  }

  _onSelectionChange = (event: {
    nativeEvent: {
      selection: Selection
    }
  }) => {
    const {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start || 0, _end || 0)
    const end = Math.max(_start || 0, _end || 0)
    this._lastNativeSelection = {end, start}
    this.props.onSelectionChange && this.props.onSelectionChange(this._lastNativeSelection)
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
    if (this.props.dummyInput) {
      this.props.onFocus && this.props.onFocus()
    } else {
      this._input.current && this._input.current.focus()
    }
  }

  blur = () => {
    this._input.current && this._input.current.blur()
  }

  isFocused = () => !!this._input.current && this._input.current.isFocused()

  _onFocus = () => {
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.props.onBlur && this.props.onBlur()
  }

  _getCommonStyle = () => {
    const textStyle = getTextStyle(this.props.textType)
    // RN TextInput plays better without this
    if (isIOS) {
      delete textStyle.lineHeight
    }
    return collapseStyles([styles.common, textStyle])
  }

  _getMultilineStyle = () => {
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const lineHeight = this._lineHeight()
    const paddingStyles: any = this.props.padding ? padding(globalMargins[this.props.padding]) : {}
    return collapseStyles([
      styles.multiline,
      {
        minHeight: (this.props.rowsMin || defaultRowsToShow) * lineHeight,
      },
      !!this.props.rowsMax && {maxHeight: this.props.rowsMax * lineHeight},
      paddingStyles,
    ])
  }

  _getSinglelineStyle = () => {
    const lineHeight = this._lineHeight()
    return collapseStyles([styles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}])
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
      allowFontScaling: this.props.allowFontScaling,
      autoCapitalize: this.props.autoCapitalize || 'none',
      autoCorrect: !!this.props.autoCorrect,
      autoFocus: this.props.autoFocus,
      children: this.props.children,
      editable: !this.props.disabled,
      keyboardAppearance: isIOS ? (isDarkMode() ? 'dark' : 'light') : undefined,
      keyboardType: this.props.keyboardType,
      multiline: false,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this._onFocus,
      onKeyPress: this.props.onKeyPress,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this.props.onEnterKeyDown,
      placeholder: this.props.placeholder,
      placeholderTextColor: this.props.placeholderColor || globalColors.black_35,
      ref: this._input,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password' || this.props.secureTextEntry,
      selectTextOnFocus: this.props.selectTextOnFocus,
      style: this._getStyle(),
      textContentType: this.props.textContentType,
      underlineColorAndroid: 'transparent',
    } as const

    if (this.props.multiline) {
      return {
        ...common,
        blurOnSubmit: false,
        multiline: true,
      }
    }
    return common
  }

  render() {
    const props = this._getProps()
    if (props.value) {
      this._lastNativeText = props.value
    }
    if (this.props.dummyInput) {
      // There are three things we want from a dummy input.
      // 1. Tapping the input does not fire the native handler. Because the native handler opens the keyboard which we don't want.
      // 2. Calls to ref.focus() on the input do not fire the native handler.
      // 3. Visual feedback is seen when tapping the input.
      // editable=false yields 1 and 2
      // pointerEvents=none yields 1 and 3
      return (
        <ClickableBox style={{flexGrow: 1}} onClick={props.onFocus}>
          <Box2 direction="horizontal" pointerEvents="none">
            <NativeTextInput {...props} editable={false} />
          </Box2>
        </ClickableBox>
      )
    }
    return <NativeTextInput {...props} />
  }
}

const styles = styleSheetCreate(() => ({
  common: {backgroundColor: globalColors.fastBlank, borderWidth: 0, flexGrow: 1},
  multiline: platformStyles({
    isMobile: {
      height: undefined,
      textAlignVertical: 'top', // android centers by default
    },
  }),
  singleline: {padding: 0},
}))

export default PlainInput
