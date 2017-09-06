// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../../styles'

import type {Props} from '.'

const CreateTeamHeader = ({onShowNewTeamDialog}: Props) => (
  <Box style={stylesContainer}>
    <Box style={{textAlign: 'center'}}>
      <Text type="BodySemibold" backgroundMode="HighRisk">
        Create a team? You’ll be able to add and remove members as you wish.{' '}
      </Text>
      <Text
        type="BodySemiboldLink"
        style={{color: globalColors.white}}
        onClick={onShowNewTeamDialog}
        underline={true}
      >
        Enter a team name
      </Text>
    </Box>
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  height: 56,
  justifyContent: 'center',
  minHeight: 56,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

export default CreateTeamHeader
