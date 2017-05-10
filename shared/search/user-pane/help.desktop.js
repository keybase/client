// @flow
import React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from './help'

export default function Help(props: Props) {
  return (
    <Box style={{width: 320, flex: 1}}>
      <Box style={{marginTop: globalMargins.xlarge, textAlign: 'center'}}>
        <Icon type="iconfont-back" style={{color: globalColors.black_40}} />
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginTop: globalMargins.small,
        }}
      >
        <Text
          type="BodySmall"
          style={{textAlign: 'center', color: globalColors.black_40}}
        >
          Open folders with anyone on these networks!
        </Text>
      </Box>
    </Box>
  )
}
