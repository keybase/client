// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './banner'

function Banner({error}: Props) {
  if (!error) return null
  return (
    <Box style={{position: 'relative'}}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          minHeight: 40,
          backgroundColor: globalColors.red,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        <Text
          type="BodySemibold"
          style={{alignSelf: 'center', textAlign: 'center', flex: 1}}
          backgroundMode="HighRisk"
        >
          {error.message}
        </Text>
      </Box>
    </Box>
  )
}

export default Banner
