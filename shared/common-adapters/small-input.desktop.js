// @flow

import React from 'react'
import Box from './box'
import Input from './input'
import Text from './text'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {SmallInputProps} from './small-input'

export default function SmallInput ({hintText, label, onChange, value, errorState}: SmallInputProps) {
  return (
    <Box style={{...globalStyles.flexBoxRow, position: 'relative'}}>
      <Text type='BodySmall' style={{position: 'absolute', bottom: 6, left: 2, color: (errorState ? globalColors.red : globalColors.blue)}}>{label}</Text>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Input hintText={hintText}
          hintStyle={{textAlign: 'left', marginLeft: 60, marginTop: 6, top: undefined}}
          inputStyle={{textAlign: 'left', marginLeft: 60, top: 2}}
          value={value}
          textStyle={{height: undefined}}
          underlineStyle={errorState ? {backgroundColor: globalColors.red} : {}}
          onChangeText={onChange} />
      </Box>
    </Box>
  )
}
