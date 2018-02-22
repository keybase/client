// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import PopupMenu from '../../common-adapters/popup-menu'
import {Avatar, Box, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {type RouteProps} from '../../route-tree/render-route'

type PopupMenuProps = RouteProps<
  {
    isTeamPath: boolean,
    items: Array<Types.PathBreadcrumbItem>,
    onOpenBreadcrumb: (path: string) => (evt?: SyntheticEvent<>) => void,
    onHidden: () => void,
  },
  {}
>

const itemView = (name, isTeamRoot) => (
  <Box style={stylesRow}>
    {isTeamRoot && <Avatar size={12} teamname={name} isTeam={true} style={stylesTeamAvatar} />}
    <Text className="title" type="Body" style={stylesMenuText}>
      {name}
    </Text>
  </Box>
)

const BreadcrumbPopupMenu = ({routeProps}: PopupMenuProps) => {
  const isTeamPath = routeProps.get('isTeamPath')
  const items = routeProps.get('items')
  const onOpenBreadcrumb = routeProps.get('onOpenBreadcrumb')
  const onHidden = routeProps.get('onHidden')
  const popupItems = items.map((i, idx) => ({
    onClick: onOpenBreadcrumb(i.path),
    title: i.name,
    view: itemView(i.name, isTeamPath && idx === items.length - 3),
  }))
  return <PopupMenu items={popupItems} style={stylePopup} onHidden={onHidden} />
}

const stylePopup = {
  marginLeft: -10,
  overflow: 'visible',
  width: 196,
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

export default BreadcrumbPopupMenu
