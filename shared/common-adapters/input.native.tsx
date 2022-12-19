// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import * as React from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.native'
import {NativeTextInput} from './native-wrappers.native'
import * as Styles from '../styles'
import {isIOS, isAndroid} from '../constants/platform'
import type {TextInput} from 'react-native'
import type {KeyboardType, Props, Selection, TextInfo} from './input'
import {checkTextInfo} from './input.shared'

type State = {
  focused: boolean
  height: number | null
}

class Input extends React.Component<Props, State> {
  state: State
  private input = React.createRef<TextInput>()
  private lastNativeText: string | null = null
  private lastNativeSelection: {
    start: number | null
    end: number | null
  } | null = null

  private timeoutIds: Array<ReturnType<typeof setTimeout>>

  private setTimeout = (f: () => void, n: number) => {
    const id = setTimeout(f, n)
    this.timeoutIds.push(id)
    return id
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      focused: false,
      height: null,
    }

    this.timeoutIds = []
  }

  componentWillUnmount() {
    this.timeoutIds.forEach(clearTimeout)
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.clearTextCounter !== this.props.clearTextCounter) {
      this.clearText()
    }
  }

  private clearText = () => {
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
  setNativeProps = (nativeProps: object) => {
    this.input.current?.setNativeProps(nativeProps)
  }

  private onContentSizeChange = (event?: {nativeEvent?: {contentSize?: {width: number; height: number}}}) => {
    if (
      this.props.multiline &&
      event?.nativeEvent?.contentSize?.height &&
      event.nativeEvent.contentSize.width
    ) {
      let height = event.nativeEvent.contentSize.height
      const minHeight = this.props.rowsMin && this.rowsToHeight(this.props.rowsMin)
      const maxHeight = this.props.rowsMax && this.rowsToHeight(this.props.rowsMax)
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

  private getValueImpl = () => {
    return (this.props.uncontrolled ? this.lastNativeText : this.props.value) || ''
  }

  getValue = (): string => {
    if (this.props.uncontrolled) {
      return this.getValueImpl()
    } else {
      throw new Error('getValue only supported on uncontrolled inputs')
    }
  }

  selection = (): Selection => {
    return this.lastNativeSelection || {end: 0, start: 0}
  }

  private onChangeTextDone = (value: string) => {
    this.props.onChangeText && this.props.onChangeText(value)
  }

  private onChangeText = (text: string) => {
    this.lastNativeText = text
    this.onChangeTextDone(text)
  }

  focus = () => {
    this.input.current && this.input.current.focus()
  }

  blur = () => {
    this.input.current && this.input.current.blur()
  }

  transformText = (fn: (textInfo: TextInfo) => TextInfo) => {
    if (!this.props.uncontrolled) {
      throw new Error('transformText can only be called on uncontrolled components')
    }

    const textInfo: TextInfo = {
      selection: this.selection(),
      text: this.getValueImpl(),
    }
    const newTextInfo = fn(textInfo)
    checkTextInfo(newTextInfo)
    this.setNativeProps({text: newTextInfo.text})
    this.lastNativeText = newTextInfo.text
    // Setting both the text and the selection at the same time
    // doesn't seem to work, but setting a short timeout to set the
    // selection does.
    this.setTimeout(() => {
      // It's possible that, by the time this runs, the selection is
      // out of bounds with respect to the current text value. So fix
      // it up if necessary.
      const text = this.getValueImpl()
      let {start, end} = newTextInfo.selection
      end = Math.max(0, Math.min(end || 0, text.length))
      start = Math.max(0, Math.min(start || 0, end))
      const selection = {end, start}
      this.setNativeProps({selection})
      this.lastNativeSelection = selection
    }, 0)
  }

  private onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
    this.setNativeProps({style: {textAlignVertical: 'top'}})
  }

  private onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  private lineHeight = () => {
    if (this.props.small) {
      return 20
    } else if (this.props.multiline && isAndroid) {
      return 34
    } else return 28
  }

  private underlineColor = () => {
    if (this.props.hideUnderline) {
      return Styles.globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return Styles.globalColors.red
    }

    return this.state.focused ? Styles.globalColors.blue : Styles.globalColors.black_10_on_white
  }

  private rowsToHeight = (rows: number) => {
    const border = this.props.hideUnderline ? 0 : 1
    return rows * this.lineHeight() + border
  }

  private containerStyle = (underlineColor: Styles.Color) => {
    return this.props.small
      ? {
          ...Styles.globalStyles.flexBoxRow,
          backgroundColor: Styles.globalColors.fastBlank,
          borderBottomColor: underlineColor,
          borderBottomWidth: 1,
          flex: 1,
        }
      : {
          ...Styles.globalStyles.flexBoxColumn,
          backgroundColor: Styles.globalColors.fastBlank,
          justifyContent: 'flex-start',
          maxWidth: 400,
        }
  }

  private onSelectionChange = (event: {
    nativeEvent: {
      selection: {
        start: number
        end: number
      }
    }
  }) => {
    const {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start, _end)
    const end = Math.max(_start, _end)
    this.lastNativeSelection = {end, start}
    // Bit of a hack here: Unlike the desktop case, where the text and
    // selection are updated simultaneously, on mobile the text gets
    // updated first, so handlers that rely on an updated selection
    // will get strange results. So trigger a text change notification
    // when the selection changes.
    this.onChangeTextDone(this.getValueImpl())
  }

  render() {
    const underlineColor = this.underlineColor()
    const lineHeight = this.lineHeight()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this.containerStyle(underlineColor)

    const singlelineStyle: Styles.StylesCrossPlatform = Styles.collapseStyles([
      styles.commonInput,
      {
        lineHeight: lineHeight,
        maxHeight: lineHeight, // ensure it doesn't grow or shrink
        minHeight: lineHeight,
        padding: 0,
      },
      this.props.small ? styles.commonInputSmall : styles.commonInputRegular,
    ])

    const multilineStyle: Styles.StylesCrossPlatform = Styles.collapseStyles([
      styles.commonInput,
      {
        height: undefined,
        lineHeight: lineHeight,
        minHeight: this.rowsToHeight(this.props.rowsMin || defaultRowsToShow),
        paddingBottom: 0,
        paddingTop: 0,
        ...(this.props.rowsMax ? {maxHeight: this.rowsToHeight(this.props.rowsMax)} : null),
      },
      this.props.small ? styles.commonInputSmall : styles.commonInputRegular,
    ])

    // Override height if we received an onContentSizeChange() earlier.
    if (isIOS && this.state.height) {
      // @ts-ignore we shouldn't reach in here
      multilineStyle.height = this.state.height
    }

    const value = this.getValueImpl()

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
      keyboardAppearance: Styles.isIOS ? (Styles.isDarkMode() ? 'dark' : 'light') : undefined,
      keyboardType,
      onBlur: this.onBlur,
      onChangeText: this.onChangeText,
      onEndEditing: this.props.onEndEditing,
      onFocus: this.onFocus,
      onSelectionChange: this.onSelectionChange,
      onSubmitEditing: this.props.onEnterKeyDown,
      placeholder: this.props.hintText,
      placeholderTextColor: Styles.globalColors.black_40,
      ref: this.input,
      returnKeyType: this.props.returnKeyType,
      secureTextEntry: this.props.type === 'password',
      selectTextOnFocus: this.props.selectTextOnFocus,
      textContentType: this.props.textContentType,
      underlineColorAndroid: 'transparent',
      ...(this.props.maxLength ? {maxLength: this.props.maxLength} : null),
    } as const

    if (!this.props.uncontrolled) {
      // @ts-ignore it's ok to add this
      commonProps.value = value
    }

    const singlelineProps = {
      ...commonProps,
      multiline: false,
      style: Styles.collapseStyles([singlelineStyle, this.props.inputStyle]),
    }

    const multilineProps = {
      ...commonProps,
      blurOnSubmit: false,
      multiline: true,
      onContentSizeChange: this.onContentSizeChange,
      style: Styles.collapseStyles([multilineStyle, this.props.inputStyle]),
      ...(this.props.rowsMax ? {maxHeight: this.rowsToHeight(this.props.rowsMax)} : {}),
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
            style={Styles.collapseStyles([styles.smallLabel, {lineHeight}, this.props.smallLabelStyle])}
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
            style={Styles.collapseStyles([styles.error, this.props.errorStyle])}
          >
            {this.props.errorText || ''}
          </Text>
        )}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => {
  const _headerTextStyle: any = getTextStyle('Header')
  const _bodyTextStyle: any = getTextStyle('Body')
  const _bodySmallTextStyle: any = getTextStyle('BodySmall')
  const _bodyErrorTextStyle: any = getTextStyle('BodySmallError')
  return {
    commonInput: {
      backgroundColor: Styles.globalColors.fastBlank,
      borderWidth: 0,
      color: Styles.globalColors.black_on_white,
      flexGrow: 1,
    },
    commonInputRegular: {
      ...Styles.globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      minWidth: 200,
      textAlign: 'center',
    },
    commonInputSmall: {
      ...Styles.globalStyles.fontRegular,
      fontSize: _bodyTextStyle.fontSize,
      textAlign: 'left',
    },

    error: {minHeight: _bodyErrorTextStyle.lineHeight},
    floating: {
      color: Styles.globalColors.blueDark,
      marginBottom: 9,
      minHeight: _bodySmallTextStyle.lineHeight,
    },
    inputContainer: {borderBottomWidth: 1},
    inputContainerSmall: {
      backgroundColor: Styles.globalColors.fastBlank,
      flex: 1,
    },
    smallLabel: {
      ...Styles.globalStyles.fontSemibold,
      color: Styles.globalColors.blueDark,
      fontSize: _headerTextStyle.fontSize,
      marginRight: 8,
    },
  }
})

export default Input
