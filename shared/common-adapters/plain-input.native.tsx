import * as React from 'react'
import * as Styles from '@/styles'
import ClickableBox from './clickable-box'
import logger from '@/logger'
import pick from 'lodash/pick'
import type {InternalProps, TextInfo, Selection} from './plain-input'
import {
  TextInput as NativeTextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native'
import {Box2} from './box'
import {checkTextInfo} from './input.shared'
import {getStyle as getTextStyle} from './text'
import {isIOS} from '@/constants/platform'
import {stringToUint8Array} from 'uint8array-extras'

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends React.PureComponent<InternalProps> {
  private _input = React.createRef<NativeTextInput>()
  private _lastNativeText: string | undefined
  private _lastNativeSelection: Selection | undefined

  get value() {
    return this._lastNativeText ?? ''
  }

  // This is controlled if a value prop is passed
  private _controlled = () => typeof this.props.value === 'string'

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: object) => {
    this._input.current?.setNativeProps(nativeProps)
  }

  private _afterTransform: (() => void) | undefined
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

    // this is a very hacky workaround for internal bugs in RN TextInput
    // write a stub with different content

    this._afterTransform = () => {
      this._afterTransform = undefined
      this.setNativeProps({text: newTextInfo.text})
      setTimeout(() => {
        this.setNativeProps({selection: newCheckedSelection})
      }, 20)
      if (reflectChange) {
        this._onChangeText(newTextInfo.text)
      }
    }

    // call if it hasn't been called already
    setTimeout(() => {
      this._afterTransform?.()
    }, 20)
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
  private _sanityCheckSelection = (selection: Selection, nativeText: string): Selection => {
    let {start, end} = selection
    end = Math.max(0, Math.min(end || 0, nativeText.length))
    start = Math.min(start || 0, end)
    return {end, start}
  }

  private _setSelection = (selection: Selection) => {
    const newSelection = this._sanityCheckSelection(selection, this._lastNativeText || '')
    this.setNativeProps({selection: newSelection})
    this._lastNativeSelection = selection
  }

  private _onChangeText = (t: string) => {
    if (this.props.maxBytes) {
      const {maxBytes} = this.props
      if (stringToUint8Array(t).byteLength > maxBytes) {
        return
      }
    }
    this._lastNativeText = t
    this.props.onChangeText?.(t)

    // call if it hasn't been called already
    this._afterTransform?.()
  }

  private _onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const {start, end} = event.nativeEvent.selection
    this._lastNativeSelection = {end, start}
    this.props.onSelectionChange?.(this._lastNativeSelection)
  }

  private _lineHeight = () => {
    const textStyle = getTextStyle(this.props.textType ?? 'Body')
    return textStyle.lineHeight
  }

  focus = () => {
    if (this.props.dummyInput) {
      this.props.onFocus?.()
    } else {
      this._input.current?.focus()
    }
  }

  clear = () => {
    this._input.current?.clear()
  }

  blur = () => {
    this._input.current?.blur()
  }

  isFocused = () => !!this._input.current?.isFocused()

  private _onFocus = () => {
    this.props.onFocus?.()
  }

  private _onBlur = () => {
    this.props.onBlur?.()
  }

  private _getCommonStyle = () => {
    const textStyle = getTextStyle(this.props.textType ?? 'Body')
    // RN TextInput plays better without this
    if (isIOS) {
      delete textStyle.lineHeight
    }
    return Styles.collapseStyles([styles.common, textStyle as any])
  }

  private _getMultilineStyle = () => {
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const lineHeight = this._lineHeight()
    const paddingStyles = this.props.padding ? Styles.padding(Styles.globalMargins[this.props.padding]) : {}
    return Styles.collapseStyles([
      styles.multiline,
      {
        minHeight: (this.props.rowsMin || defaultRowsToShow) * (lineHeight ?? 0),
      },
      !!this.props.rowsMax && {maxHeight: this.props.rowsMax * (lineHeight ?? 0)},
      paddingStyles,
    ])
  }

  private _getSinglelineStyle = () => {
    const lineHeight = this._lineHeight()
    return Styles.collapseStyles([styles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}])
  }

  private _getStyle = () => {
    return Styles.collapseStyles([
      this._getCommonStyle(),
      this.props.multiline ? this._getMultilineStyle() : this._getSinglelineStyle(),
      this.props.style,
    ])
  }

  onImageChange = (e: NativeSyntheticEvent<{uri: string; linkUri: string}>) => {
    if (this.props.onPasteImage) {
      const {uri, linkUri} = e.nativeEvent
      uri && this.props.onPasteImage(linkUri || uri)
    }
  }

  private _onSubmitEditing = () => {
    this.props.onEnterKeyDown?.()
  }

  private _getProps = () => {
    const common = {
      ...pick(this.props, ['maxLength', 'value']), // Props we should only passthrough if supplied
      allowFontScaling: this.props.allowFontScaling,
      autoCapitalize: this.props.autoCapitalize || 'none',
      autoCorrect: !!this.props.autoCorrect,
      autoFocus: this.props.autoFocus,
      children: this.props.children,
      editable: !this.props.disabled,
      // needed to workaround changing this not doing the right thing
      key: this.props.type,
      keyboardType: this.props.keyboardType ?? 'default',
      multiline: false,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this._onFocus,
      onImageChange: this.onImageChange,
      onKeyPress: this.props.onKeyPress,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this._onSubmitEditing,
      placeholder: this.props.placeholder,
      placeholderTextColor: Styles.globalColors.black_35,
      ref: this._input,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password' || this.props.secureTextEntry,
      // currently broken on ios https://github.com/facebook/react-native/issues/30585
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

const styles = Styles.styleSheetCreate(() => ({
  common: {backgroundColor: Styles.globalColors.fastBlank, borderWidth: 0, flexGrow: 1},
  multiline: Styles.platformStyles({
    isMobile: {
      height: undefined,
      textAlignVertical: 'top', // android centers by default
    },
  }),
  singleline: {padding: 0},
}))

export default PlainInput
