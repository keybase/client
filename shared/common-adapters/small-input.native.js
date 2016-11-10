// @flow
import React from 'react'
import type {SmallInputProps} from './small-input'
import {NativeTextInput} from './native-wrappers.native'
import Box from './box'
import Text, {getStyle} from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {isAndroid} from '../constants/platform'

export default function SmallInput ({autoCapitalize, autoCorrect = false, errorState, hintText, label, onChange, style, value, autoFocus, onEnterKeyDown}: SmallInputProps) {
  return (
    <Box style={{...styleContainer(!!errorState), ...style}}>
      <Text type='BodySmallSemibold' style={styleLabel}>{label}</Text>
      <NativeTextInput
        style={{...getStyle('Header'), ...styleInput}}
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

const styleLabel = {
  alignSelf: 'flex-end',
  color: globalColors.blue,
  marginRight: globalMargins.xtiny,
  ...(isAndroid ? {
    marginBottom: 2,
  } : null),
}

const styleInput = {
  textAlign: 'left',
  flex: 1,
  padding: 0,
}
