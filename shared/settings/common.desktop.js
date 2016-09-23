// @flow
import React from 'react'
import {Box, Icon} from '../common-adapters'
import {range} from 'lodash'
import {globalStyles, globalColors} from '../styles'
import {levelToStars} from '../constants/settings'

import type {PlanLevel} from '../constants/settings'

function Stars ({level}: {level: PlanLevel}) {
  const starCount = levelToStars[level]
  return (
    <Box style={globalStyles.flexBoxRow}>
      {range(starCount).map(i => <Icon key={i} style={{color: globalColors.green}} type='iconfont-star' />)}
    </Box>
  )
}

export {
  Stars,
}

