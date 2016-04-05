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

// TODO figure out how to make a passwordVisible type
// We don't want to set this to clear text because that gives
// permission to the OS to let the text be saved to use for predictive typing.

class Input extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      inputFocused: false,
      text: this.props.value || ''
    }
  }

  render () {
    const IOS = Platform.OS_IOS === OS
    const inputStyle = Text.textStyle({type: 'BodySemibold'}, {})

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        {this.state.text.length > 0 && <Text type='BodySmall' style={{...floatingLabelStyle}}>{this.props.floatingLabelText}</Text>}
        <TextInput
          style={{...inputStyle, ...textInputStyle}}
          defaultValue={this.props.value}
          secureTextEntry={this.props.type === 'password' || this.props.type === 'passwordVisible'}
          autoFocus={this.props.autoFocus}
          placeholder={this.props.hintText}
          placeholderColor={globalColors.black10}
          underlineColorAndroid={this.state.inputFocused ? globalColors.blue : globalColors.black10}
          onFocus={() => this.setState({inputFocused: true})}
          onBlur={() => this.setState({inputFocused: false})}
          onSubmitEditing={this.props.onEnterKeyDown}
          onChange={this.props.onChange}
          onChangeText={text => this.setState({text})} />
        {IOS && <HorizontalLine focused={this.state.inputFocused}/>}
        {this.props.errorText && <Text type='Error' style={{...errorText, ...this.props.errorStyle}}>{this.props.errorText}</Text>}
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
  backgroundColor: focused ? globalColors.blue : globalColors.black10
}}/>

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  height: 36,
  position: 'relative',
  marginTop: 21
}

const textInputStyle = {
  textAlign: 'center',
  position: 'absolute',
  top: 0,
  bottom: -8,
  left: -4,
  right: -4
}

const floatingLabelStyle = {
  color: globalColors.blue,
  textAlign: 'center',
  position: 'relative',
  height: 21,
  top: -21
}

const errorText = {
  textAlign: 'center',
  position: 'absolute',
  left: 0,
  right: 0,
  top: 36
}

export default Input
