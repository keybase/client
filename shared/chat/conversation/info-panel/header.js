// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Text} from '../../../common-adapters'
import {globalMargins, globalStyles, isMobile} from '../../../styles'

type Props = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
}

const SmallTeamHeader = ({teamname, participantCount, onClick}: Props) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: globalMargins.small,
      marginTop: globalMargins.small,
    }}
    onClick={onClick}
  >
    <Avatar size={isMobile ? 48 : 32} teamname={teamname} isTeam={true} />
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
      <Text type="BodySemibold">{teamname}</Text>
      <Box style={globalStyles.flexBoxRow}>
        <Text type="BodySmall">
          {participantCount.toString() + ' member' + (participantCount !== 1 ? 's' : '')}
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

export {SmallTeamHeader}
