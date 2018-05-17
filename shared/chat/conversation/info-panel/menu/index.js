// @flow
import * as React from 'react'
import {Avatar, Box, FloatingMenu, Text} from '../../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'

type Props = {
  attachTo: ?React.Component<any, any>,
  badgeSubscribe: boolean,
  canAddPeople: boolean,
  isSmallTeam: boolean,
  manageChannelsSubtitle: string,
  manageChannelsTitle: string,
  memberCount: number,
  teamname: string,
  visible: boolean,
  onAddPeople: () => void,
  onHidden: () => void,
  onInvite: () => void,
  onLeaveTeam: () => void,
  onManageChannels: () => void,
  onViewTeam: () => void,
}

const Header = ({teamname, memberCount}: {teamname: string, memberCount: number}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', paddingTop: 16}}>
    <Avatar size={isMobile ? 64 : 48} teamname={teamname} style={{marginBottom: isMobile ? 4 : 2}} />
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
        subTitle: props.manageChannelsSubtitle,
        title: props.manageChannelsTitle,
      }
    : {
        onClick: props.onManageChannels,
        title: props.manageChannelsTitle,
        view: (
          <Box style={globalStyles.flexBoxRow}>
            <Text style={styleText} type={isMobile ? 'BodyBig' : 'Body'}>
              {props.manageChannelsTitle}
            </Text>
            {props.badgeSubscribe && (
              <Box style={collapseStyles([styleBadge, !isMobile && styleBadgeDesktop])} />
            )}
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

  return (
    <FloatingMenu
      attachTo={props.attachTo}
      visible={props.visible}
      items={items}
      header={header}
      onHidden={props.onHidden}
      position="bottom left"
      closeOnSelect={true}
    />
  )
}

const styleBadge = {
  backgroundColor: globalColors.blue,
  borderRadius: 6,
  height: 8,
  margin: 6,
  width: 8,
}

const styleBadgeDesktop = {
  margin: 4,
  marginTop: 5,
  right: globalMargins.tiny,
  position: 'absolute',
}

const styleText = {
  color: isMobile ? globalColors.blue : undefined,
}

export {InfoPanelMenu}
