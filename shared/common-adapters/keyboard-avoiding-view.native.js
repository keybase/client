// @flow
import React from 'react'
import type {Props} from './keyboard-avoiding-view'
import {KeyboardAvoidingView} from 'react-native'

const KeyboardAvoidingBox = ({behavior, children, style}: Props) => (
  <KeyboardAvoidingView
    behavior={behavior}
    style={style}>
    {children}
  </KeyboardAvoidingView>
)

export default KeyboardAvoidingBox
