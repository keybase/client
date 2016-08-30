// @flow
import React from 'react'
import type {Props} from './keyboard-avoiding-box'
import {KeyboardAvoidingView} from 'react-native'

const KeyboardAvoidingBox = ({behavior, children, style}: Props) => (
  <KeyboardAvoidingView
    behavior={behavior}
    style={style}>
    {children}
  </KeyboardAvoidingView>
)

export default KeyboardAvoidingBox
