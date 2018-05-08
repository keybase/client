// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {type RouteProps} from '../../route-tree/render-route'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Icon, Box, Text} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile, platformStyles} from '../../styles'

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
  minHeight: 24,
}

const stylesPopup = platformStyles({
  isMobile: {
    width: '100%',
  },
  isElectron: {
    position: 'absolute',
    left: 88,
    top: 80,
  },
})

const styleIcon = {
  marginRight: globalMargins.tiny,
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
            <Icon
              type={sortSettingIconType}
              style={styleIcon}
              color={isMobile ? globalColors.blue : globalColors.black_75}
              fontSize={isMobile ? 17 : 13}
            />
          </Box>
          <Text type={isMobile ? 'BodyBig' : 'Body'} style={stylesText}>
            {sortSettingText}
          </Text>
        </Box>
      ),
    }
  })
  return (
    <ModalLessPopupMenu header={{title: ''}} items={popupItems} style={stylesPopup} onHidden={onHidden} />
  )
}

const stylesText = platformStyles({
  isMobile: {
    color: globalColors.blue,
  },
})

export default SortBarPopupMenu
