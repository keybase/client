// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Box, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'
import PathItemIcon from '../common/path-item-icon'

type PopupMenuProps = {
  items: Array<{
    path: Types.Path,
    name: string,
    styles: Types.ItemStyles,
    onOpenBreadcrumb: (evt?: SyntheticEvent<>) => void,
  }>,
  onHidden: () => void,
}

const BreadcrumbPopupMenu = ({items, onHidden}: PopupMenuProps) => {
  const popupItems = items.map(item => ({
    onClick: item.onOpenBreadcrumb,
    title: Types.pathToString(item.path),
    view: (
      <Box style={stylesRow}>
        <PathItemIcon spec={item.styles.iconSpec} style={pathItemIconStyle} small={true} />
        <Text type="Body" lineClamp={1}>
          {item.name}
        </Text>
      </Box>
    ),
  }))
  return <ModalLessPopupMenu items={popupItems} style={stylePopup} onHidden={onHidden} />
}

const stylePopup = {
  width: isMobile ? '100%' : 196,
  marginTop: isMobile ? undefined : 12,
  marginLeft: isMobile ? undefined : -12,
}

const stylesRow = {
  ...globalStyles.flexBoxRow,
}

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

export default BreadcrumbPopupMenu
