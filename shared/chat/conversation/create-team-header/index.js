// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

import type {Props} from '.'

const CreateTeamHeader = ({onShowNewTeamDialog}: Props) => (
  <Box style={isMobile ? stylesMobileContainer : stylesDesktopContainer}>
    <Box style={isMobile ? {alignItems: 'center'} : {textAlign: 'center'}}>
      <Text type="BodySemibold" backgroundMode="HighRisk">
        Create a team? You’ll be able to add and remove members as you wish.{' '}
      </Text>
      <Text
        type="BodySemiboldLink"
        style={{color: globalColors.white}}
        onClick={onShowNewTeamDialog}
        underline={true}
        className="underline"
        backgroundMode="Terminal"
      >
        Enter a team name
      </Text>
    </Box>
  </Box>
)

const stylesDesktopContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  height: 56,
  justifyContent: 'center',
  minHeight: 56,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const stylesMobileContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  minHeight: 56,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

export default CreateTeamHeader
