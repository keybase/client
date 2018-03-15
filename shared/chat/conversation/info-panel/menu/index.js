// @flow
import * as React from 'react'
import PopupMenu, {ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {isMobile} from '../../../../styles'

type Props = {
  canAddPeople: boolean,
  isSmallTeam: boolean,
  onAddPeople: () => void,
  onClose: () => void,
  onInvite: () => void,
  onLeaveTeam: () => void,
  onManageChannels: () => void,
  onViewTeam: () => void,
}

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

  return isMobile ? (
    <PopupMenu onHidden={props.onClose} style={{overflow: 'visible'}} items={items} />
  ) : (
    <ModalLessPopupMenu onHidden={() => {}} style={{overflow: 'visible', width: 200}} items={items} />
  )
}

export {InfoPanelMenu}
