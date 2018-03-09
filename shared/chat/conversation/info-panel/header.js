// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../../common-adapters'
import {globalMargins, globalStyles, isMobile} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
  onClickGear: () => void,
}

const SmallTeamHeader = ({canManage, teamname, participantCount, onClick, onClickGear}: SmallProps) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: globalMargins.small,
      marginTop: globalMargins.small,
    }}
    onClick={evt => !evt.defaultPrevented && onClick()}
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
    <Icon
      type="iconfont-gear"
      onClick={evt => {
        evt.preventDefault()
        onClickGear()
      }}
      style={{marginRight: 16}}
    />
  </ClickableBox>
)

type BigProps = {
  channelname: string,
  teamname: string,
  onClick: () => void,
}

const BigTeamHeader = ({channelname, teamname, onClick}: BigProps) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
      <Text style={{alignSelf: 'center', marginTop: globalMargins.medium}} type="BodyBig">
        #{channelname}
      </Text>
      <ClickableBox
        style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'center'}}
        onClick={onClick}
      >
        <Avatar teamname={teamname} size={12} />
        <Text type="BodySmallSemibold" style={{marginLeft: globalMargins.xtiny}}>
          {teamname}
        </Text>
      </ClickableBox>
    </Box>
  )
}

export {SmallTeamHeader, BigTeamHeader}
