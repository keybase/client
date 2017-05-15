// @flow
import React from 'react'
import {Box, Icon} from '../common-adapters'
import {range} from 'lodash'
import {globalStyles, globalColors} from '../styles'

function Stars({count}: {count: number}) {
  return (
    <Box style={globalStyles.flexBoxRow}>
      {range(count).map(i => (
        <Icon key={i} style={{color: globalColors.green}} type="iconfont-star" />
      ))}
    </Box>
  )
}

export {Stars}
