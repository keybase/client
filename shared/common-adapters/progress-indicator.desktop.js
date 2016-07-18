/* @flow */

import React from 'react'
import type {Props} from './progress-indicator'
import Icon from './icon'

const ProgressIndicator = ({white, style}: Props) => (
  <Icon
    style={style}
    type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'} />
)

export default ProgressIndicator
