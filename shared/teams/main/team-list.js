// @flow
import * as React from 'react'
import {ClickableBox, Icon, Avatar, Box, Divider, Text, ProgressIndicator} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

import type {Teamname, TeamListRow} from '../../constants/teams'

export type Props = {
  teamrows: Array<TeamListRow>,
  onOpenFolder: (teamname: Teamname) => void,
  onManageChat: (teamname: Teamname) => void,
  onViewTeam: (teamname: Teamname) => void,
}

type RowProps = {
  team: TeamListRow,
  onOpenFolder: () => void,
  onManageChat: () => void,
  onViewTeam: () => void,
}

const Row = ({team, onOpenFolder, onManageChat, onViewTeam}: RowProps) => (
  <Box style={rowStyle}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        marginRight: globalMargins.tiny,
      }}
    >
      <ClickableBox style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}} onClick={onViewTeam}>
        <Avatar size={isMobile ? 48 : 32} teamname={team.teamName} isTeam={true} />
        <Text type="BodySemibold" style={{flex: 1, marginLeft: globalMargins.small}}>
          {team.teamName}
        </Text>
        {team.memberCount != null &&
          <Text type="BodySemiboldItalic" style={{marginRight: globalMargins.small}}>
            {team.memberCount + ' member' + (team.memberCount !== 1 ? 's' : '')}
          </Text>}
      </ClickableBox>
      {!isMobile && <Icon type="iconfont-folder-private" onClick={onOpenFolder} />}
      {!isMobile &&
        <Icon type="iconfont-chat" style={{marginLeft: globalMargins.small}} onClick={onManageChat} />}
    </Box>
    {!isMobile && <Divider style={{marginLeft: 48}} />}
  </Box>
)

const TeamList = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    {!props.loaded && <ProgressIndicator style={{alignSelf: 'center', width: 20}} />}
    {props.teamrows.map((row, index, arr) => (
      <Row
        key={row.teamName}
        team={row}
        onOpenFolder={() => props.onOpenFolder(row.teamName)}
        onManageChat={() => props.onManageChat(row.teamName)}
        onViewTeam={() => props.onViewTeam(row.teamName)}
      />
    ))}
  </Box>
)

const rowStyle = {
  ...globalStyles.flexBoxColumn,
  flexShrink: 0,
  minHeight: isMobile ? 64 : 48,
}

export default TeamList
