// @flow
import * as React from 'react'
import PopupMenu, {ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {Avatar, Box, Text} from '../../../../common-adapters'
import {globalColors, globalStyles, isMobile} from '../../../../styles'

type Props = {
  badgeSubscribe: boolean,
  canAddPeople: boolean,
  isSmallTeam: boolean,
  memberCount: number,
  teamname: string,
  onAddPeople: () => void,
  onClose: () => void,
  onInvite: () => void,
  onLeaveTeam: () => void,
  onManageChannels: () => void,
  onViewTeam: () => void,
}

const Header = ({teamname, memberCount}: {teamname: string, memberCount: number}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', paddingTop: 16}}>
    <Avatar size={isMobile ? 32 : 16} teamname={teamname} style={{marginBottom: 2}} />
    <Text type="BodySemibold">{teamname}</Text>
    <Text type="BodySmall">{`${memberCount} member${memberCount !== 1 ? 's' : ''}`}</Text>
  </Box>
)

const InfoPanelMenu = (props: Props) => {
  const addPeopleItems = [
    {
      title: 'Add someone by username',
      subTitle: 'Keybase, Twitter, etc.',
      onClick: props.onAddPeople,
      style: {borderTopWidth: 0},
    },
    {
      title: isMobile ? 'Add someone from address book' : 'Add someone by email',
      onClick: props.onInvite,
    },
  ]
  const channelItem = props.isSmallTeam
    ? {
        onClick: props.onManageChannels,
        subTitle: 'Turns this into a big team',
        title: 'Make chat channels...',
      }
    : {
        onClick: props.onManageChannels,
        title: 'Subscribe to channels...',
        view: (
          <Box style={globalStyles.flexBoxRow}>
            {props.badgeSubscribe && <Box style={styleBadge} />}
            <Text style={styleText} type={isMobile ? 'BodyBig' : 'Body'}>
              Subscribe to channels...
            </Text>
          </Box>
        ),
      }

  const items = [
    ...(props.canAddPeople ? addPeopleItems : []),
    {title: 'View team', onClick: props.onViewTeam, style: {borderTopWidth: 0}},
    channelItem,
    {title: 'Leave team', onClick: props.onLeaveTeam, danger: true},
  ]

  const header = {
    title: 'header',
    view: <Header teamname={props.teamname} memberCount={props.memberCount} />,
  }

  return isMobile ? (
    <PopupMenu header={header} onHidden={props.onClose} style={{overflow: 'visible'}} items={items} />
  ) : (
    <ModalLessPopupMenu
      header={header}
      onHidden={() => {}}
      style={{overflow: 'visible', width: 200}}
      items={items}
    />
  )
}

const styleBadge = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  margin: isMobile ? 6 : 4,
  width: 8,
}

const styleText = {
  color: isMobile ? globalColors.blue : undefined,
}

export {InfoPanelMenu}
