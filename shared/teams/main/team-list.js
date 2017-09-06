// @flow
import * as React from 'react'
import {ClickableBox, Icon, Avatar, Box, Divider, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

import type {Teamname} from '../../constants/teams'

export type Props = {
  teamnames: Array<Teamname>,
  onOpenFolder: (teamname: Teamname) => void,
  onManageChat: (teamname: Teamname) => void,
  onViewTeam: (teamname: Teamname) => void,
}

type RowProps = {
  name: Teamname,
  onOpenFolder: () => void,
  onManageChat: () => void,
  onViewTeam: () => void,
}

const Row = ({name, onOpenFolder, onManageChat, onViewTeam}: RowProps) => (
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
        <Avatar size={32} teamname={name} isTeam={true} />
        <Text type="BodySemibold" style={{flex: 1, marginLeft: globalMargins.tiny}}>
          {name}
        </Text>
      </ClickableBox>
      <Icon
        type="iconfont-folder-private"
        onClick={e => {
          e.stopPropagation()
          onOpenFolder()
        }}
      />
      <Icon
        type="iconfont-chat"
        style={{marginLeft: globalMargins.small}}
        onClick={e => {
          e.stopPropagation()
          onManageChat()
        }}
      />
    </Box>
    {!isMobile && <Divider style={{marginLeft: 44}} />}
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
    {props.teamnames.map((name, index, arr) => (
      <Row
        key={name}
        name={name}
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
  minHeight: 48,
}

export default TeamList
