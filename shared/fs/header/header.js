// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'

export type FolderHeaderProps = {
  breadcrumbItems: Array<Types.PathBreadcrumbItem>,
  dropdownItems: Array<Types.PathBreadcrumbItem>,
  isTeamPath: boolean,
  onOpenBreadcrumbDropdown: (evt?: SyntheticEvent<>) => void,
}

const FolderHeader = ({
  dropdownItems,
  breadcrumbItems,
  isTeamPath,
  onOpenBreadcrumbDropdown,
}: FolderHeaderProps) => (
  <Box>
    {breadcrumbItems.length === 1 ? (
      <Box style={folderHeaderStyleRoot}>
        <Text type="BodyBig">Keybase Files</Text>
      </Box>
    ) : (
      <Box style={folderHeaderStyleTree}>
        {dropdownItems.length > 0 && (
          <Box style={folderBreadcrumbStyle}>
            <ClickableBox style={styleBreadcrumbDropdownIconBox} onClick={onOpenBreadcrumbDropdown}>
              <Icon type="iconfont-folder-dropdown" style={styleBreadcrumbDropdownIcon} />
            </ClickableBox>
            <Icon type="iconfont-arrow-right" style={iconStyle} />
          </Box>
        )}
        {breadcrumbItems.map(i => (
          <Box key={i.name} style={folderBreadcrumbStyle}>
            {i.isTlfNameItem &&
              isTeamPath && <Avatar size={12} teamname={i.name} isTeam={true} style={styleTeamAvatar} />}
            {i.isLastItem ? (
              <Text type="BodyBig" style={styleTailBreadcrumb}>
                {i.name}
              </Text>
            ) : (
              <Box style={folderBreadcrumbStyle}>
                <ClickableBox onClick={i.onOpenBreadcrumb}>
                  <Text type="BodySmallSemibold" style={styleParentBreadcrumb}>
                    {i.name}
                  </Text>
                </ClickableBox>
                <Icon type="iconfont-arrow-right" style={iconStyle} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )}
  </Box>
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

const styleParentBreadcrumb = {
  color: globalColors.black_60,
}

const styleTailBreadcrumb = {}

const iconStyle = {
  fontSize: 11,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const styleBreadcrumbDropdownIcon = {
  ...iconStyle,
  fontSize: 16,
  marginLeft: 0,
}

const styleBreadcrumbDropdownIconBox = {
  marginTop: 2,
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

export default FolderHeader
