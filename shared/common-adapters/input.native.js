// @flow
import Platform, {OS} from '../constants/platform'
import React, {Component} from 'react'
import type {Props} from './input'
import {Box, Text, NativeTextInput} from './index.native'
import {globalColors, globalStyles} from '../styles'

/* ==========
 * =  BUGS  =
 * ==========
 *
 * iOS:
 *  - Placeholder text (hintText) is top left aligned. (AW 2016-08-26)
 *  - Multiline inputs appear to get pushed ~4px right of center. (AW 2016-08-26)
 *
 * Android:
 *  - Auto grow does not work. (AW 2016-8-26)
 *    - The text will size to the initial dimensions, it just won't expand after a user types.
 *    - onContentSizeChange never gets called again.
 *  - Cursor is hidden when multiline text exceeds element bounds (AW 2016-08-26)
 *    - Instead of the element focus following the cursor like in single line.
 *  - Multiline flag changes the padding amount required to adjust for native element chrome. (AW 2016-08-26)
 *
 */

type State = {
  inputFocused: boolean,
  text: string,
  textHeight: number,
}

class Input extends Component<void, Props, State> {
  state: State;
  _textInput: any;

  constructor (props: Props) {
    super(props)
    this.state = {
      inputFocused: false,
      text: this.props.value || '',
      textHeight: 0,
    }
  }

  _setPasswordVisible (props: Props) {
    const passwordVisible = props.type === 'passwordVisible'
    if (this._textInput) {
      this._textInput.setNativeProps({passwordVisible})
    }
  }

  componentWillUpdate (nextProps: Props) {
    if (nextProps.type !== this.props.type) {
      this._setPasswordVisible(nextProps)
    }
  }

  _onContentSizeChange (event: SyntheticEvent) {
    // $ForceType
    const nativeEvent: {contentSize: {height: number}} = event.nativeEvent
    this.setState({
      textHeight: nativeEvent.contentSize.height,
    })
  }

  render () {
    const isIOS = Platform.OS_IOS === OS
    const isShowingFloatingLabel = this.state.text.length > 0
    const password = this.props.type === 'password'
    const autoGrow = this.props.autoGrow
      ? {onContentSizeChange: (event) => this._onContentSizeChange(event)}
      : {}
    const autoGrowActive = isIOS && this.props.autoGrow

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        {isShowingFloatingLabel &&
          <Text
            type='BodySmall'
            style={{...floatingLabelStyle}}>
            {this.props.floatingLabelText}
          </Text>}
        <NativeTextInput
          style={{
            ...Text.textStyle({type: 'BodySemibold'}, {}),
            ...textInputStyle({...this.state, ...this.props, isShowingFloatingLabel, autoGrowActive}),
            ...this.props.inputStyle,
          }}
          keyboardType={this.props.keyboardType}
          ref={component => { this._textInput = component }}
          autoCorrect={this.props.hasOwnProperty('autoCorrect') && this.props.autoCorrect}
          defaultValue={this.props.value}
          secureTextEntry={password}
          autoFocus={this.props.autoFocus}
          placeholder={this.props.hintText}
          placeholderColor={globalColors.black_10}
          underlineColorAndroid={this.state.inputFocused ? globalColors.blue : globalColors.black_10}
          multiline={this.props.multiline}
          numberOfLines={this.props.rows}
          autoCapitalize={this.props.autoCapitalize || 'none'}
          onFocus={() => this.setState({inputFocused: true})}
          onBlur={() => this.setState({inputFocused: false})}
          onSubmitEditing={this.props.onEnterKeyDown}
          {...autoGrow}
          onChange={this.props.onChange}
          onChangeText={text => { this.setState({text}); this.props.onChangeText && this.props.onChangeText(text) }} />
        {isIOS && !this.props.iosOmitUnderline &&
          <HorizontalLine focused={this.state.inputFocused} />}
        {!!(this.props.errorText) &&
          <Text
            type='BodyError'
            style={{...errorText, ...this.props.errorStyle}}>
            {this.props.errorText}
          </Text>}
      </Box>
    )
  }
}

const FLOATING_LABEL_HEIGHT = 18
const FLOATING_LABEL_OFFSET = -4
const TEXT_INPUT_PLATFORM_PADDING = OS === Platform.OS_IOS
  ? 6 // Minor padding adjustment needed on iOS
  : 18 // Large padding adjustment needed on Android b/c native view has padding

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
}

const floatingLabelStyle = {
  color: globalColors.blue,
  textAlign: 'center',
  height: FLOATING_LABEL_HEIGHT,
  lineHeight: FLOATING_LABEL_HEIGHT,
}

const textInputStyle = ({isShowingFloatingLabel, textHeight, rows, multiline, autoGrowActive}: {
  isShowingFloatingLabel: boolean,
  textHeight: number,
  rows?: number,
  multiline?: boolean,
  autoGrowActive?: boolean,
}) => {
  const MIN_TEXT_HEIGHT = Text.textStyle({type: 'BodySemibold'}, {}).lineHeight + TEXT_INPUT_PLATFORM_PADDING
  return {
    marginTop: (isShowingFloatingLabel ? 0 : FLOATING_LABEL_HEIGHT) + FLOATING_LABEL_OFFSET,
    height: Math.max(textHeight, (autoGrowActive ? 1 : rows || 1) * MIN_TEXT_HEIGHT),
    textAlign: 'center',
    // BUG (AW): adjust for an odd bug in iOS that causes multiline inputs to
    // not center their contents properly
    marginLeft: (multiline && OS === Platform.OS_IOS) ? 4 : 0,
  }
}

const errorText = {
  textAlign: 'center',
}

const HorizontalLine = ({focused}) => <Box style={{
  left: 0,
  right: 0,
  height: 1,
  backgroundColor: focused ? globalColors.blue : globalColors.black_10,
}} />

export default Input
