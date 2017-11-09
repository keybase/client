// @flow
import * as React from 'react'
import {
  ClickableBox,
  Icon,
  Avatar,
  Badge,
  Box,
  Divider,
  Text,
  ProgressIndicator,
  Meta,
} from '../../common-adapters'
import {globalMargins, globalStyles, globalColors} from '../../styles'
import {isMobile} from '../../constants/platform'

import type {Teamname} from '../../constants/teams'

export type Props = {
  teamnames: Array<Teamname>,
  teammembercounts: {[string]: number},
  newTeams: Array<Teamname>,
  newTeamRequests: Array<Teamname>,
  onOpenFolder: (teamname: Teamname) => void,
  onManageChat: (teamname: Teamname) => void,
  onViewTeam: (teamname: Teamname) => void,
}

type RowProps = {
  name: Teamname,
  membercount: number,
  isNew: boolean,
  newRequests: number,
  onOpenFolder: () => void,
  onManageChat: () => void,
  onViewTeam: () => void,
}

export const newCharmStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 1,
  marginRight: 4,
  alignSelf: 'center',
}

const Row = ({name, membercount, isNew, newRequests, onOpenFolder, onManageChat, onViewTeam}: RowProps) => (
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
        <Avatar size={isMobile ? 48 : 32} teamname={name} isTeam={true} />
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
          <Text type="BodySemibold">
            {name}
          </Text>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
            {!!newRequests &&
              <Badge badgeNumber={newRequests} badgeStyle={{marginLeft: 0, marginRight: 3, marginTop: 1}} />}
            {isNew && <Meta title="NEW" style={newCharmStyle} />}
            <Text type="BodySmall">
              {membercount + ' member' + (membercount !== 1 ? 's' : '')}
            </Text>
          </Box>
        </Box>
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
    {props.teamnames.map((name, index, arr) => (
      <Row
        key={name}
        name={name}
        isNew={props.newTeams.includes(name)}
        newRequests={props.newTeamRequests.filter(team => team === name).length}
        membercount={props.teammembercounts[name]}
        onOpenFolder={() => props.onOpenFolder(name)}
        onManageChat={() => props.onManageChat(name)}
        onViewTeam={() => props.onViewTeam(name)}
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
