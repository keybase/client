// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {type RouteProps} from '../../route-tree/render-route'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Icon, Box, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'

type SortBarPopupMenuProps = RouteProps<
  {
    sortSettingToAction: Types._SortSetting => () => void,
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
  justifyContent: 'start',
  minHeight: isMobile ? 24 : 24,
}

const stylesPopup = {
  position: 'absolute',
  left: '88px',
  top: '64px',
}
const stylesIcon = {
  marginRight: globalMargins.xtiny,
  color: globalColors.black_75,
}

const SortBarPopupMenu = (props: SortBarPopupMenuProps) => {
  const sortSettingToAction = props.routeProps.get('sortSettingToAction')
  const popupItems = sortSettings.map(sortSetting => {
    const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(sortSetting)
    return {
      onClick: sortSettingToAction(sortSetting),
      title: sortSettingText,
      view: (
        <Box style={stylesSortSetting}>
          <Icon type={sortSettingIconType} style={stylesIcon} />
          <Text type="Body">{sortSettingText}</Text>
        </Box>
      ),
    }
  })
  return <ModalLessPopupMenu items={popupItems} style={stylesPopup} />
}

export default SortBarPopupMenu
