/* @flow */

import React, {Component} from 'react'
import {TextInput} from 'react-native'
import {globalColors, globalStyles} from '../styles/style-guide'
import Platform, {OS} from '../constants/platform'
import Text from './text.native'
import Box from './box'

import type {Props} from './input'

type State = {
  inputFocused: boolean,
  text: string
}

class Input extends Component<void, Props, State> {
  state: State;
  _textInput: any;

  constructor (props: Props) {
    super(props)
    this.state = {
      inputFocused: false,
      text: this.props.value || '',
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

  render () {
    const IOS = Platform.OS_IOS === OS
    const inputStyle = Text.textStyle({type: 'BodySemibold'}, {})
    const password = this.props.type === 'password'
    const passwordVisible = this.props.type === 'passwordVisible'

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        {this.state.text.length > 0 && <Text type='BodySmall' style={{...floatingLabelStyle}}>{this.props.floatingLabelText}</Text>}
        <TextInput
          style={{...inputStyle, ...textInputStyle, ...(IOS && this.props.multiLine && IOSMultilineTextInputStyle || {})}}
          keyboardType={this.props.keyboardType}
          ref={component => { this._textInput = component }}
          autoCorrect={!(password || passwordVisible)}
          defaultValue={this.props.value}
          secureTextEntry={password}
          autoFocus={this.props.autoFocus}
          placeholder={this.props.hintText}
          placeholderColor={globalColors.black_10}
          underlineColorAndroid={this.state.inputFocused ? globalColors.blue : globalColors.black_10}
          multiline={this.props.multiLine}
          numberOfLines={this.props.rows}
          autoCapitalize={this.props.autoCapitalize || 'none'}
          onFocus={() => this.setState({inputFocused: true})}
          onBlur={() => this.setState({inputFocused: false})}
          onSubmitEditing={this.props.onEnterKeyDown}
          onChange={this.props.onChange}
          onChangeText={text => { this.setState({text}); this.props.onChangeText && this.props.onChangeText(text) }} />
        {IOS && !this.props.iosOmitUnderline && <HorizontalLine focused={this.state.inputFocused} />}
        {!!(this.props.errorText) && <Text type='Error' style={{...errorText, ...this.props.errorStyle}}>{this.props.errorText}</Text>}
      </Box>
    )
  }
}

const HorizontalLine = ({focused}) => <Box style={{
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 1,
  backgroundColor: focused ? globalColors.blue : globalColors.black_10,
}} />

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  height: 36,
  position: 'relative',
  marginTop: 21,
}

const textInputStyle = {
  textAlign: 'center',
  textAlignVertical: 'bottom',
  position: 'absolute',
  top: 0,
  bottom: -8,
  left: -4,
  right: -4,
}

const IOSMultilineTextInputStyle = {
  bottom: 0,
}

const floatingLabelStyle = {
  color: globalColors.blue,
  textAlign: 'center',
  position: 'relative',
  height: 21,
  top: -21,
}

const errorText = {
  textAlign: 'center',
  position: 'absolute',
  left: 0,
  right: 0,
  top: 36,
}

export default Input
