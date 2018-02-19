// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Avatar, Box, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

type PopupMenuProps = {
  items: Array<Types.PathBreadcrumbItem>,
  isTeamPath: boolean,
  onOpenBreadcrumb: (path: string) => void,
}

const itemView = (name, isTeamRoot) => (
  <Box style={stylesRow}>
    {isTeamRoot && <Avatar size={12} teamname={name} isTeam={true} style={stylesTeamAvatar} />}
    <Text className="title" type="Body" style={stylesMenuText}>
      {name}
    </Text>
  </Box>
)

export const DropdownPopupMenu = ({items, isTeamPath, onOpenBreadcrumb}: PopupMenuProps) => {
  const popupItems = items.map((i, idx) => ({
    onClick: () => {
      onOpenBreadcrumb(i.path)
    },
    title: i.name,
    view: itemView(i.name, isTeamPath && idx === items.length - 3),
  }))
  return <ModalLessPopupMenu items={popupItems} style={stylePopup} />
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
  marginLeft: -10,
}

const stylesMenuText = {
  color: undefined,
}

const stylesRow = {
  ...globalStyles.flexBoxRow,
}

const stylesTeamAvatar = {
  marginRight: globalMargins.tiny,
  marginTop: 3,
}
