// @flow
// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import React, {Component} from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text'
import {NativeTextInput} from './native-wrappers.native'
import {collapseStyles, globalStyles, globalColors, styleSheetCreate} from '../styles'
import {isIOS} from '../constants/platform'

import type {Props} from './input'

type State = {
  focused: boolean,
  height: ?number,
  selections: {selectionStart: number, selectionEnd: number} | null,
}

class Input extends Component<Props, State> {
  state: State
  _input: NativeTextInput | null

  constructor(props: Props) {
    super(props)

    // For now, leave selections null until we get the first selection
    // notification, since we're unable to set selection on
    // NativeTextInput.

    this.state = {
      focused: false,
      height: null,
      selections: null,
    }
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

  getValue(): string {
    return this.props.value || ''
  }

  _onChangeText = (text: string) => {
    this.props.onChangeText && this.props.onChangeText(text)
  }

  focus() {
    this._input && this._input.focus()
  }

  blur() {
    this._input && this._input.blur()
  }

  replaceText = (
    text: string,
    startIdx: number,
    endIdx: number,
    newSelectionStart: number,
    newSelectionEnd: number
  ) => {
    const v = this.getValue()
    const nextText = v.slice(0, startIdx) + text + v.slice(endIdx)
    this._onChangeText(nextText)
    this.setState({selections: {selectionStart: newSelectionStart, selectionEnd: newSelectionEnd}})
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  _lineHeight() {
    if (this.props.small) {
      return 20
    } else return 28
  }

  _underlineColor() {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10_on_white
  }

  _rowsToHeight(rows) {
    const border = this.props.hideUnderline ? 0 : 1
    return rows * this._lineHeight() + border
  }

  _containerStyle(underlineColor) {
    return this.props.small
      ? {
          ...globalStyles.flexBoxRow,
          backgroundColor: globalColors.fastBlank,
          borderBottomWidth: 1,
          borderBottomColor: underlineColor,
          flex: 1,
        }
      : {
          ...globalStyles.flexBoxColumn,
          backgroundColor: globalColors.fastBlank,
          justifyContent: 'flex-start',
          maxWidth: 400,
        }
  }

  _onSelectionChange = (event: {nativeEvent: {selection: {start: number, end: number}}}) => {
    const selection = {
      selectionStart: event.nativeEvent.selection.start,
      selectionEnd: event.nativeEvent.selection.end,
    }
    this.setState(
      {
        selections: selection,
      },
      () => this.props.onSelectionChange && this.props.onSelectionChange(selection)
    )
  }

  // WARNING may not be up to date in time sensitive situations
  selections() {
    return this.state.selections
  }

  render() {
    const underlineColor = this._underlineColor()
    const lineHeight = this._lineHeight()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      color: globalColors.black_75_on_white,
      lineHeight: lineHeight,
      backgroundColor: globalColors.fastBlank,
      flexGrow: 1,
      borderWidth: 0,
      ...(this.props.small
        ? {...globalStyles.fontRegular, fontSize: _bodyTextStyle.fontSize, textAlign: 'left'}
        : {
            ...globalStyles.fontSemibold,
            fontSize: _headerTextStyle.fontSize,
            textAlign: 'center',
            minWidth: 200,
          }),
    }

    const singlelineStyle = {
      ...commonInputStyle,
      maxHeight: lineHeight, // ensure it doesn't grow or shrink
      minHeight: lineHeight,
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

    const value = this.getValue()

    const floatingHintText =
      !!value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
        ? this.props.floatingHintTextOverride
        : this.props.hintText || ' ')

    // We want to be able to set the selection property,
    // too. Unfortunately, that triggers an Android crash:
    // https://github.com/facebook/react-native/issues/18316 .
    const commonProps = {
      autoCorrect: this.props.hasOwnProperty('autoCorrect') && this.props.autoCorrect,
      autoCapitalize: this.props.autoCapitalize || 'none',
      editable: this.props.hasOwnProperty('editable') ? this.props.editable : true,
      keyboardType: this.props.keyboardType,
      autoFocus: this.props.autoFocus,
      onBlur: this._onBlur,
      onChangeText: this._onChangeText,
      onFocus: this._onFocus,
      onSelectionChange: this._onSelectionChange,
      onSubmitEditing: this.props.onEnterKeyDown,
      onEndEditing: this.props.onEndEditing,
      placeholder: this.props.hintText,
      ref: (r: NativeTextInput | null) => {
        this._input = r
      },
      returnKeyType: this.props.returnKeyType,
      value,
      secureTextEntry: this.props.type === 'password',
      underlineColorAndroid: 'transparent',
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    const singlelineProps = {
      ...commonProps,
      multiline: false,
      style: collapseStyles([singlelineStyle, this.props.inputStyle]),
    }

    const multilineProps = {
      ...commonProps,
      multiline: true,
      blurOnSubmit: false,
      onContentSizeChange: this._onContentSizeChange,
      style: collapseStyles([multilineStyle, this.props.inputStyle]),
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : {}),
    }

    return (
      <Box style={[containerStyle, this.props.style]}>
        {!this.props.small && (
          <Text type="BodySmall" style={styles.floating}>
            {floatingHintText}
          </Text>
        )}
        {!!this.props.small &&
          !!this.props.smallLabel && (
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
        {!this.props.small && (
          <Text type="BodyError" style={collapseStyles([styles.error, this.props.errorStyle])}>
            {this.props.errorText || ''}
          </Text>
        )}
      </Box>
    )
  }
}

const _headerTextStyle = getTextStyle('Header')
const _bodyTextStyle = getTextStyle('Body')
const _bodySmallTextStyle = getTextStyle('BodySmall')
const _bodyErrorTextStyle = getTextStyle('BodyError')

const styles = styleSheetCreate({
  error: {
    minHeight: _bodyErrorTextStyle.lineHeight,
    textAlign: 'center',
  },
  floating: {
    color: globalColors.blue,
    marginBottom: 9,
    minHeight: _bodySmallTextStyle.lineHeight,
    textAlign: 'center',
  },
  inputContainer: {
    borderBottomWidth: 1,
  },
  inputContainerSmall: {
    backgroundColor: globalColors.fastBlank,
    flex: 1,
  },
  smallLabel: {
    ...globalStyles.fontSemibold,
    color: globalColors.blue,
    fontSize: _headerTextStyle.fontSize,
    marginRight: 8,
  },
})

export default Input
