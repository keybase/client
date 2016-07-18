/* @flow */

import React from 'react'
import {Box} from '../common-adapters'
import type {Props} from './confirm-or-pending'

const Render = ({platform}: Props) => {
  return (
    <Box>
      <p>{platform}</p>
    </Box>
  )
}

export default Render
