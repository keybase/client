// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {type RouteProps} from '../../route-tree/render-route'
import PopupMenu from '../../common-adapters/popup-menu'
import {Icon, Box, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'

type SortBarPopupMenuProps = RouteProps<
  {
    sortSettingToAction: Types._SortSetting => () => void,
    onHidden: () => void,
  },
  {}
>

const sortSettings = [
  {sortBy: 'name', sortOrder: 'asc'},
  {sortBy: 'name', sortOrder: 'desc'},
  {sortBy: 'time', sortOrder: 'asc'},
  {sortBy: 'time', sortOrder: 'desc'},
]

const stylesSortSetting = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
  minHeight: isMobile ? 24 : 24,
}

const stylesPopup = {
  position: 'absolute',
  left: 88,
  top: 80,
}
const stylesIcon = {
  marginRight: globalMargins.tiny,
  color: globalColors.black_75,
  fontSize: 13,
}

const iconBoxStyle = {
  marginTop: 3,
}

const SortBarPopupMenu = ({routeProps}: SortBarPopupMenuProps) => {
  const sortSettingToAction = routeProps.get('sortSettingToAction')
  const onHidden = routeProps.get('onHidden')
  const popupItems = sortSettings.map(sortSetting => {
    const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(sortSetting)
    return {
      onClick: sortSettingToAction(sortSetting),
      title: sortSettingText,
      view: (
        <Box style={stylesSortSetting}>
          <Box style={iconBoxStyle}>
            <Icon type={sortSettingIconType} style={stylesIcon} />
          </Box>
          <Text type="Body">{sortSettingText}</Text>
        </Box>
      ),
    }
  })
  return <PopupMenu items={popupItems} style={stylesPopup} onHidden={onHidden} />
}

export default SortBarPopupMenu
