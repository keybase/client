// @flow
import React from 'react'
import Box from './box'
import Input from './input'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {SmallInputProps} from './small-input'

export default function SmallInput ({errorState, hintText, label, onChange, style, value, onEnterKeyDown}: SmallInputProps) {
  return (
    <Box style={{...styleContainer, ...style}}>
      <Text type='BodySmall' style={styleLabel(!!errorState)}>{label}</Text>
      <Box style={styleInputContainer}>
        <Input hintText={hintText}
          hintStyle={styleInputHint}
          inputStyle={styleInputUser}
          value={value}
          textStyle={{height: undefined}}
          underlineStyle={errorState ? {backgroundColor: globalColors.red} : {}}
          onEnterKeyDown={onEnterKeyDown}
          onChangeText={onChange} />
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  position: 'relative',
}

const styleLabel = (hasError: boolean) => ({
  position: 'absolute',
  bottom: 7,
  left: 2,
  color: (hasError ? globalColors.red : globalColors.blue),
})

const styleInputContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleInputHint = {
  textAlign: 'left',
  marginLeft: 60,
  marginTop: 0,
  bottom: undefined,
}

const styleInputUser = {
  textAlign: 'left',
  marginLeft: 60,
  top: 2,
}
