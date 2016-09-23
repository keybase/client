// @flow
import React from 'react'
import {Text} from '../common-adapters'
import {levelToStars} from '../constants/settings'

import type {PlanLevel} from '../constants/settings'

function Stars ({level}: {level: PlanLevel}) {
  // TODO(mm) use actual icon here
  return <Text type='BodySmall'>{'*****'.substring(0, levelToStars[level])}</Text>
}

export {
  Stars,
}

