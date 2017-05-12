// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalColors, globalMargins} from '../../styles'

export type Props = {
  username: string,
}

export default function Loading({username}: Props) {
  return (
    <Box style={{width: 320, flex: 1}}>
      <Box style={{marginTop: globalMargins.xlarge, textAlign: 'center'}}>
        <Text
          type="BodySmall"
          style={{textAlign: 'center', color: globalColors.black_40}}
        >
          Loading profile for {username}
        </Text>
      </Box>
    </Box>
  )
}
