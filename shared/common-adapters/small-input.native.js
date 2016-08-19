// @flow
import React from 'react'
import type {SmallInputProps} from './small-input'
import {Box, Text, NativeTextInput} from './index.native'
import {globalColors, globalMargins, globalStyles} from '../styles/style-guide'

export default function SmallInput ({autoCapitalize, autoCorrect, errorState, hintText, label, onChange, style, value, autoFocus}: SmallInputProps) {
  return (
    <Box style={{...styleContainer(!!errorState), ...style}}>
      <Text type='BodySmall' style={styleLabel(!!errorState)}>{label}</Text>
      <NativeTextInput
        style={{...Text.textStyle({type: 'BodySemibold'}, {}), ...styleInput}}
        placeholder={hintText}
        placeholderTextColor={globalColors.black_10}
        underlineColorAndroid={'transparent'}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChange} />
    </Box>
  )
}

const styleContainer = (hasError: boolean) => ({
  ...globalStyles.flexBoxRow,
  borderBottomWidth: 1,
  borderColor: (hasError ? globalColors.red : globalColors.black_10),
  paddingBottom: 2,
})

const styleLabel = (hasError: boolean) => ({
  color: (hasError ? globalColors.red : globalColors.blue),
  marginRight: globalMargins.xtiny,
})

const styleInput = {
  textAlign: 'left',
  flex: 1,
  padding: 0,
}
