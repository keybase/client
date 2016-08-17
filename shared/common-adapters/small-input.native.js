// @flow
import React from 'react'
import {TextInput} from 'react-native'
import Box from './box'
import Text from './text.native'
import {globalColors, globalMargins, globalStyles} from '../styles/style-guide'

import type {SmallInputProps} from './small-input'

export default function SmallInput ({autoCapitalize, autoCorrect, errorState, hintText, label, onChange, style, value}: SmallInputProps) {
  return (
    <Box style={{...styleContainer(errorState), ...style}}>
      <Text type='BodySmall' style={styleLabel(errorState)}>{label}</Text>
      <TextInput
        style={{...Text.textStyle({type: 'BodySemibold'}, {}), ...styleInput}}
        placeholder={hintText}
        placeholderTextColor={globalColors.black_10}
        underlineColorAndroid={'transparent'}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
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
}
