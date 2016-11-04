// @flow
import React from 'react'
import type {SmallInputProps} from './small-input'
import {Box, Text, NativeTextInput} from './index.native'
import {getStyle} from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

export default function SmallInput ({autoCapitalize, autoCorrect = false, errorState, hintText, label, onChange, style, value, autoFocus, onEnterKeyDown}: SmallInputProps) {
  return (
    <Box style={{...styleContainer(!!errorState), ...style}}>
      <Text type='BodySmall' style={styleLabel(!!errorState)}>{label}</Text>
      <NativeTextInput
        style={{...getStyle('BodySemibold'), ...styleInput}}
        placeholder={hintText}
        placeholderTextColor={globalColors.black_10}
        underlineColorAndroid={'transparent'}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        value={value}
        onEnterKeyDown={onEnterKeyDown}
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
