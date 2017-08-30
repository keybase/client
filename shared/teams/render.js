// @flow
import * as React from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles} from '../styles'

import type {Props} from './render'

function TeamsRender(props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Text type="BodySmall">Teams are still very early-stage!</Text>
      <Text type="BodySmall">
        For now the GUI only allows you to create simple teams
        no channels or subteams, but you can get to more complex teams
        using the command line.
      </Text>
      <Text type="BodySmall">Read the doc</Text>
    </Box>
  )
}

export default TeamsRender
