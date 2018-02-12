// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../common-adapters'
import HeaderConnector from './header-container'

type FolderHeaderProps = {
  breadcrumbItems: Array<Types.PathBreadcrumbItem>,
  dropdownItems: Array<Types.PathBreadcrumbItem>,
  isTeamPath: boolean,
  onOpenBreadcrumb: (path: string) => void,
}

const FolderHeader = HeaderConnector(
  ({dropdownItems, breadcrumbItems, isTeamPath, onOpenBreadcrumb}: FolderHeaderProps) => (
    <Box>
      {breadcrumbItems.length === 1 ? (
        <Box style={folderHeaderStyleRoot}>
          <Text type="BodyBig">Keybase Files</Text>
        </Box>
      ) : (
        <Box style={folderHeaderStyleTree}>
          {dropdownItems.length > 0 && (
            <Box style={folderBreadcrumbStyle}>
              <Box style={styleBreadcrumbDropdownIconBox}>
                <Icon type="iconfont-folder-private" style={styleBreadcrumbDropdownIcon} />
              </Box>
              <Icon type="iconfont-back" style={iconStyle} />
            </Box>
          )}
          {breadcrumbItems.map((i, idx) => (
            <Box key={i.path} style={folderBreadcrumbStyle}>
              {i.idx === 2 &&
                isTeamPath && <Avatar size={12} teamname={i.name} isTeam={true} style={styleTeamAvatar} />}
              {idx === breadcrumbItems.length - 1 ? (
                <Text type="BodyBig">{i.name}</Text>
              ) : (
                <Box style={folderBreadcrumbStyle}>
                  <ClickableBox onClick={() => onOpenBreadcrumb(i.path)}>
                    <Text type="BodySmallSemibold" style={styleParentBreadcrumb}>
                      {i.name}
                    </Text>
                  </ClickableBox>
                  <Icon type="iconfont-back" style={iconStyle} />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
)

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  minHeight: isMobile ? 64 : 48,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
}

const folderBreadcrumbStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 0,
  paddingRight: 0,
}

const styleParentBreadcrumb = {color: globalColors.black_60}

const iconStyle = {
  fontSize: 11,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const styleBreadcrumbDropdownIcon = {
  ...iconStyle,
  fontSize: 15,
}

const styleBreadcrumbDropdownIconBox = {
  marginTop: globalMargins.xtiny,
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

export default FolderHeader
