// @flow
import * as React from 'react'
import PopupMenu, {ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {Avatar, Box, Text} from '../../../../common-adapters'
import {globalStyles, isMobile} from '../../../../styles'

type Props = {
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
    <Avatar size={16} teamname={teamname} style={{marginBottom: 2}} />
    <Text type="BodySemibold">{teamname}</Text>
    <Text type="BodySmall">{`${memberCount} member${memberCount !== 1 ? 's' : ''}`}</Text>
  </Box>
)

const InfoPanelMenu = (props: Props) => {
  const addPeopleItems = [
    {title: 'Add someone by username', subTitle: 'Keybase, Twitter, etc.', onClick: props.onAddPeople},
    {
      title: isMobile ? 'Add someone from address book' : 'Add someone by email',
      onClick: props.onInvite,
      style: {borderTopWidth: 0},
    },
  ]
  const channelItem = {
    title: props.isSmallTeam ? 'Make chat channels...' : 'Manage chat channels',
    onClick: props.onManageChannels,
    subTitle: props.isSmallTeam ? 'Turns this into a big team' : undefined,
    style: {borderTopWidth: 0},
  }
  const items = [
    ...(props.canAddPeople ? addPeopleItems : []),
    {title: 'View team', onClick: props.onViewTeam},
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

export {InfoPanelMenu}
