// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins, isMobile} from '../../../styles'

type Props = {
  onShowNewTeamDialog: () => void,
}

const CreateTeamHeader = ({onShowNewTeamDialog}: Props) => (
  <Box style={stylesContainer}>
    <Box style={isMobile ? {alignItems: 'center'} : {textAlign: 'center'}}>
      <Text type="BodySmallSemibold" backgroundMode="HighRisk">
        Create a team? You’ll be able to add and remove members as you wish.{' '}
      </Text>
      <Text
        type="BodySmallSemiboldPrimaryLink"
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

const stylesContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
}

export default CreateTeamHeader
