// @flow
import React from 'react'
import Box from './box'
import Text from './text'
import {globalColors, globalMargins} from '../styles'

export type Props = {
  error: string,
}

export default function ErrorLoadingProfile ({error}: Props) {
  return (
    <Box style={{width: 320, flex: 1}}>
      <Box style={{marginTop: globalMargins.xlarge, textAlign: 'center'}}>
        <Text type='BodyError' style={{textAlign: 'center', color: globalColors.black_40}}>Error loading profile: {error}</Text>
      </Box>
    </Box>
  )
}
