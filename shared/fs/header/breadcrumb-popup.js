// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Avatar, Box, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {type RouteProps} from '../../route-tree/render-route'
import {isMobile} from '../../constants/platform'

type PopupMenuProps = RouteProps<
  {
    isTeamPath: boolean,
    items: Array<Types.PathBreadcrumbItem>,
    onHidden: () => void,
  },
  {}
>

const itemView = (name, isTeamRoot) => (
  <Box style={stylesRow}>
    {isTeamRoot && <Avatar size={16} teamname={name} isTeam={true} style={stylesTeamAvatar} />}
    <Text className="title" type="Body" style={stylesMenuText}>
      {name}
    </Text>
  </Box>
)

const BreadcrumbPopupMenu = ({routeProps}: PopupMenuProps) => {
  const isTeamPath = routeProps.get('isTeamPath')
  const items = routeProps.get('items')
  const onHidden = routeProps.get('onHidden')
  const popupItems = items.map((i, idx) => ({
    onClick: i.onOpenBreadcrumb,
    title: i.name,
    view: itemView(i.name, isTeamPath && idx === items.length - 3),
  }))
  return <ModalLessPopupMenu items={popupItems} style={stylePopup} onHidden={onHidden} />
}

const stylePopup = {
  width: isMobile ? '100%' : 196,
  marginTop: isMobile ? undefined : 12,
  marginLeft: isMobile ? undefined : -12,
}

const stylesMenuText = {
  color: undefined,
}

const stylesRow = {
  ...globalStyles.flexBoxRow,
}

const stylesTeamAvatar = {
  marginRight: globalMargins.tiny,
  marginTop: 1,
}

export default BreadcrumbPopupMenu
