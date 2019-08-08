// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import React, {Component} from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.native'
import {NativeTextInput} from './native-wrappers.native'
import {collapseStyles, globalStyles, globalColors, styleSheetCreate} from '../styles'
import {isIOS, isAndroid} from '../constants/platform'
import {TextInput} from 'react-native'
import {KeyboardType, Props, Selection, TextInfo} from './input'
import {checkTextInfo} from './input.shared'

type State = {
  focused: boolean
  height: number | null
}

class Input extends Component<Props, State> {
  state: State
  _input = React.createRef<TextInput>()
  _lastNativeText: string | null = null
  _lastNativeSelection: {
    start: number | null
    end: number | null
  } | null = null

  // TODO: Remove once we can use HOCTimers.
  _timeoutIds: Array<NodeJS.Timeout>

  // We define _setTimeout instead of using HOCTimers since we'd need
  // to use React.forwardRef with HOCTimers, and it doesn't seem to
  // work with React Native yet.
  _setTimeout = (f, n) => {
    const id = setTimeout(f, n)
    this._timeoutIds.push(id)
    return id
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      focused: false,
      height: null,
    }

    // TODO: Remove once we can use HOCTimers.
    this._timeoutIds = []
  }

  // TODO: Remove once we can use HOCTimers.
  componentWillUnmount = () => {
    this._timeoutIds.forEach(clearTimeout)
  }

  componentDidUpdate = (prevProps: Props) => {
    if (prevProps.clearTextCounter !== this.props.clearTextCounter) {
      this._clearText()
    }
  }

  _clearText = () => {
    if (!this.props.uncontrolled) {
      throw new Error('clearTextCounter only works on uncontrolled components')
    }

    this.transformText(() => ({
      selection: {end: 0, start: 0},
      text: '',
    }))
  }

  // Does nothing on mobile
  select = () => {}

  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  setNativeProps = (nativeProps: Object) => {
    this._input.current && this._input.current.setNativeProps(nativeProps)
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

  _getValue = () => {
    return (this.props.uncontrolled ? this._lastNativeText : this.props.value) || ''
  }

  getValue = (): string => {
    if (this.props.uncontrolled) {
      return this._getValue()
    } else {
      throw new Error('getValue only supported on uncontrolled inputs')
    }
  }

  selection = (): Selection => {
    return this._lastNativeSelection || {end: 0, start: 0}
  }

  _onChangeTextDone = (value: string) => {
    this.props.onChangeText && this.props.onChangeText(value)
  }

  _onChangeText = (text: string) => {
    this._lastNativeText = text
    this._onChangeTextDone(text)
  }

  focus = () => {
    this._input.current && this._input.current.focus()
  }

  blur = () => {
    this._input.current && this._input.current.blur()
  }

  transformText = (fn: (textInfo: TextInfo) => TextInfo) => {
    if (!this.props.uncontrolled) {
      throw new Error('transformText can only be called on uncontrolled components')
    }

    const textInfo: TextInfo = {
      selection: this.selection(),
      text: this._getValue(),
    }
    const newTextInfo = fn(textInfo)
    checkTextInfo(newTextInfo)
    this.setNativeProps({text: newTextInfo.text})
    this._lastNativeText = newTextInfo.text
    // Setting both the text and the selection at the same time
    // doesn't seem to work, but setting a short timeout to set the
    // selection does.
    this._setTimeout(() => {
      // It's possible that, by the time this runs, the selection is
      // out of bounds with respect to the current text value. So fix
      // it up if necessary.
      const text = this._getValue()
      let {start, end} = newTextInfo.selection
      end = Math.max(0, Math.min(end || 0, text.length))
      start = Math.max(0, Math.min(start || 0, end))
      const selection = {end, start}
      this.setNativeProps({selection})
      this._lastNativeSelection = selection
    }, 0)
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
    this.setNativeProps({style: {textAlignVertical: 'top'}})
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  _lineHeight = () => {
    if (this.props.small) {
      return 20
    } else if (this.props.multiline && isAndroid) {
      return 34
    } else return 28
  }

  _underlineColor = () => {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10_on_white
  }

  _rowsToHeight = rows => {
    const border = this.props.hideUnderline ? 0 : 1
    return rows * this._lineHeight() + border
  }

  _containerStyle = underlineColor => {
    return this.props.small
      ? {
          ...globalStyles.flexBoxRow,
          backgroundColor: globalColors.fastBlank,
          borderBottomColor: underlineColor,
          borderBottomWidth: 1,
          flex: 1,
        }
      : {
          ...globalStyles.flexBoxColumn,
          backgroundColor: globalColors.fastBlank,
          justifyContent: 'flex-start',
          maxWidth: 400,
        }
  }

  _onSelectionChange = (event: {
    nativeEvent: {
      selection: {
        start: number
        end: number
      }
    }
  }) => {
    let {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start, _end)
    const end = Math.max(_start, _end)
    this._lastNativeSelection = {end, start}
    // Bit of a hack here: Unlike the desktop case, where the text and
    // selection are updated simultaneously, on mobile the text gets
    // updated first, so handlers that rely on an updated selection
    // will get strange results. So trigger a text change notification
    // when the selection changes.
    this._onChangeTextDone(this._getValue())
  }

  render = () => {
    const underlineColor = this._underlineColor()
    const lineHeight = this._lineHeight()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      backgroundColor: globalColors.fastBlank,
      borderWidth: 0,
      color: globalColors.black_on_white,
      flexGrow: 1,
      lineHeight: lineHeight,
      ...(this.props.small
        ? {
            ...globalStyles.fontRegular,
            fontSize: _bodyTextStyle.fontSize,
            textAlign: 'left',
          }
        : {
            ...globalStyles.fontSemibold,
            fontSize: _headerTextStyle.fontSize,
            minWidth: 200,
            textAlign: 'center',
          }),
    }

    const singlelineStyle = {
      ...commonInputStyle,
      maxHeight: lineHeight, // ensure it doesn't grow or shrink
      minHeight: lineHeight,
      padding: 0,
    }

    const multilineStyle: any = {
      ...commonInputStyle,
      height: undefined,
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      paddingBottom: 0,
      paddingTop: 0,
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : null),
    }

    // Override height if we received an onContentSizeChange() earlier.
    if (isIOS && this.state.height) {
      multilineStyle.height = this.state.height
    }

    const value = this._getValue()

    const floatingHintText =
      !!value.length &&
      (Object.prototype.hasOwnProperty.call(this.props, 'floatingHintTextOverride')
        ? this.props.floatingHintTextOverride
        : this.props.hintText || ' ')

    let keyboardType: KeyboardType | null = this.props.keyboardType || null
    if (!keyboardType) {
      if (isAndroid && this.props.type === 'passwordVisible') {
        keyboardType = 'visible-password'
      } else {
        // Defers to secureTextEntry when props.type === 'password'.
        keyboardType = 'default'
      }
    }

    // We want to be able to set the selection property,
    // too. Unfortunately, that triggers an Android crash:
    // https://github.com/facebook/react-native/issues/18316 .
    const commonProps = {
      autoCapitalize: this.props.autoCapitalize || 'none',
      autoCorrect: Object.prototype.hasOwnProperty.call(this.props, 'autoCorrect') && this.props.autoCorrect,
      autoFocus: this.props.autoFocus,
      editable: Object.prototype.hasOwnProperty.call(this.props, 'editable') ? this.props.editable : true,
      keyboardType,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this._onFocus,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this.props.onEnterKeyDown,
      placeholder: this.props.hintText,
      ref: this._input,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      selectTextOnFocus: this.props.selectTextOnFocus,
      textContentType: this.props.textContentType,
      underlineColorAndroid: 'transparent',
      ...(this.props.maxLength ? {maxLength: this.props.maxLength} : null),
    }

    if (!this.props.uncontrolled) {
      // @ts-ignore it's ok to add this
      commonProps.value = value
    }

    const singlelineProps = {
      ...commonProps,
      multiline: false,
      style: collapseStyles([singlelineStyle, this.props.inputStyle]),
    }

    const multilineProps = {
      ...commonProps,
      blurOnSubmit: false,
      multiline: true,
      onContentSizeChange: this._onContentSizeChange,
      style: collapseStyles([multilineStyle, this.props.inputStyle]),
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : {}),
    }

    return (
      <Box style={[containerStyle, this.props.style]}>
        {!this.props.small && !this.props.hideLabel && (
          <Text center={true} type="BodySmall" style={styles.floating}>
            {floatingHintText}
          </Text>
        )}
        {!!this.props.small && !!this.props.smallLabel && !this.props.hideLabel && (
          <Text
            type="BodySmall"
            style={collapseStyles([styles.smallLabel, {lineHeight}, this.props.smallLabelStyle])}
          >
            {this.props.smallLabel}
          </Text>
        )}
        <Box
          style={
            this.props.small
              ? styles.inputContainerSmall
              : [styles.inputContainer, {borderBottomColor: underlineColor}]
          }
        >
          <NativeTextInput {...(this.props.multiline ? multilineProps : singlelineProps)} />
        </Box>
        {!!this.props.errorTextComponent && this.props.errorTextComponent}
        {!this.props.small && (
          <Text
            center={true}
            type="BodySmallError"
            style={collapseStyles([styles.error, this.props.errorStyle])}
          >
            {this.props.errorText || ''}
          </Text>
        )}
      </Box>
    )
  }
}

const _headerTextStyle: any = getTextStyle('Header')
const _bodyTextStyle: any = getTextStyle('Body')
const _bodySmallTextStyle: any = getTextStyle('BodySmall')
const _bodyErrorTextStyle: any = getTextStyle('BodySmallError')

const styles = styleSheetCreate({
  error: {minHeight: _bodyErrorTextStyle.lineHeight},
  floating: {
    color: globalColors.blueDark,
    marginBottom: 9,
    minHeight: _bodySmallTextStyle.lineHeight,
  },
  inputContainer: {borderBottomWidth: 1},
  inputContainerSmall: {
    backgroundColor: globalColors.fastBlank,
    flex: 1,
  },
  smallLabel: {
    ...globalStyles.fontSemibold,
    color: globalColors.blueDark,
    fontSize: _headerTextStyle.fontSize,
    marginRight: 8,
  },
})

export default Input
