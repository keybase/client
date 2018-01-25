// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Text} from '../../../common-adapters'
import {globalMargins, globalStyles, isMobile} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
}

const SmallTeamHeader = ({teamname, participantCount, onClick}: SmallProps) => (
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

type BigProps = {
  channelname: string,
  teamname: string,
  onClick: () => void,
}

const BigTeamHeader = ({channelname, teamname, onClick}: BigProps) => {
  return [
    <Text
      key="bigTeamHeaderChannelName"
      style={{alignSelf: 'center', marginTop: globalMargins.medium}}
      type="BodyBig"
    >
      #{channelname}
    </Text>,

    <ClickableBox
      key="bigTeamHeaderTeamName"
      style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'center'}}
      onClick={onClick}
    >
      <Avatar teamname={teamname} size={12} />
      <Text type="BodySmallSemibold" style={{marginLeft: globalMargins.xtiny}}>
        {teamname}
      </Text>
    </ClickableBox>,
  ]
}

export {SmallTeamHeader, BigTeamHeader}
