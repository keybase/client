// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './banner'

function Banner({error, style}: Props) {
  if (!error) return null
  return (
    <Box style={{position: 'relative', ...style}}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor: globalColors.red,
          left: 0,
          minHeight: 40,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      >
        <Text
          type="BodySmallSemibold"
          style={{alignSelf: 'center', flex: 1, textAlign: 'center'}}
          backgroundMode="HighRisk"
        >
          {error.message}
        </Text>
      </Box>
    </Box>
  )
}

export default Banner
