// @flow
import React from 'react'
import {Avatar, Box, Text, Icon, PopupMenu} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  memberCount: number,
  onManageChannels: () => void,
  onSetShowMenu: boolean => void,
  onViewTeam: () => void,
  teamname: string,
}

const zIndexMenu = 20

const TeamInfoMenu = (props: Props) => (
  <PopupMenu
    header={{
      title: 'Header',
      view: (
        <Box style={teamHeaderStyle}>
          <Avatar teamname={props.teamname} size={16} />
          <Text type="BodySmallSemibold" style={teamStyle}>{props.teamname}</Text>
          <Text type="BodySmall">
            {props.memberCount + ' member' + (props.memberCount !== 1 ? 's' : '')}
          </Text>
        </Box>
      ),
    }}
    items={[
      {onClick: props.onManageChannels, title: 'Manage chat channels'},
      {onClick: props.onViewTeam, title: 'View team'},
    ]}
    onHidden={() => props.onSetShowMenu(false)}
    style={{
      position: isMobile ? 'relative' : 'absolute',
      right: globalMargins.tiny,
      top: globalMargins.small,
      zIndex: zIndexMenu,
    }}
  />
)

const teamHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  padding: globalMargins.tiny,
}

const teamStyle = {
  color: globalColors.darkBlue,
  flexGrow: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export default TeamInfoMenu
