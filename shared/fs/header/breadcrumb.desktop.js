// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Avatar, Box, Icon, Text} from '../../common-adapters'
import BreadcrumbPopup from './breadcrumb-popup.desktop'

type Props = {
  dropdownItems?: Array<Types.PathBreadcrumbItem>,
  shownItems: Array<Types.PathBreadcrumbItem>,
}

const Breadcrumb = ({dropdownItems, shownItems}: Props) => (
  <Box style={stylesContainer}>
    {!!dropdownItems && (
      <Box style={folderBreadcrumbStyle}>
        <BreadcrumbPopup items={dropdownItems} />
        <Icon type="iconfont-arrow-right" style={iconStyle} fontSize={11} />
      </Box>
    )}
    {shownItems.map((item, idxItem) => (
      <React.Fragment key={Types.pathToString(item.path)}>
        {item.isTeamTlf && <Avatar size={16} teamname={item.name} isTeam={true} style={styleTeamAvatar} />}
        {!item.isLastItem ? (
          <Box style={stylesBreadcrumbNonLastItemBox}>
            <Text key={idxItem} onClick={item.onClick} type="BodySmallSemibold">
              {item.name}
            </Text>
          </Box>
        ) : (
          <Box style={stylesBreadcrumbLastItemBox}>
            <Text type="BodyBig" selectable={true}>
              {// We are splitting on ',' here, so it won't work for
              // long names that don't have comma. If this becomes a
              // problem, we might have to do smarter splitting that
              // involve other characters, or just break the long name
              // apart into 3-character groups.
              item.name.split(',').map((sub, idx, {length}) => (
                <Text key={idx} type={'BodyBig'} style={stylesLastNameText}>
                  {sub}
                  {idx !== length - 1 ? ',' : ''}
                </Text>
              ))}
            </Text>
          </Box>
        )}
        {!item.isLastItem && <Icon type="iconfont-arrow-right" style={iconStyle} fontSize={11} />}
      </React.Fragment>
    ))}
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxRow,
  left: 0,
  right: 0,
  flexGrow: 1,
  alignItems: 'flex-start',
  paddingLeft: 16,
  paddingRight: 16,
}

const folderBreadcrumbStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 0,
  paddingRight: 0,
  flexShrink: 0,
  flexWrap: 'wrap',
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

const iconStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const stylesBreadcrumbNonLastItemBox = {
  maxWidth: 120,
  flexShrink: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: globalColors.black_60,
  whiteSpace: 'nowrap',
}

const stylesBreadcrumbLastItemBox = {
  display: 'flex',
  flexWrap: 'wrap',
}

const stylesLastNameText = platformStyles({
  isElectron: {
    wordBreak: 'break-word',
  },
})

export default Breadcrumb
