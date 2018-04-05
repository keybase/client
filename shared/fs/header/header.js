// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {Avatar, BackButton, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import ConnectedFilesBanner from '../banner/container'

export type FolderHeaderProps = {
  breadcrumbItems: Array<Types.PathBreadcrumbItem>,
  dropdownPath: string,
  isTeamPath: boolean,
  path: Types.Path,
  onBack: () => void,
  onOpenBreadcrumbDropdown: (evt?: SyntheticEvent<>) => void,
  openInFileUI: () => void,
}

const FolderHeader = ({
  dropdownPath,
  breadcrumbItems,
  isTeamPath,
  path,
  onBack,
  onOpenBreadcrumbDropdown,
  openInFileUI,
}: FolderHeaderProps) => (
  <Box style={styleHeaderContainer}>
    <Box style={styleFolderHeader}>
      {breadcrumbItems.length === 1 ? (
        <Box style={folderHeaderStyleRoot}>
          <Text type="BodyBig">Keybase Files</Text>
        </Box>
      ) : isMobile ? (
        <Box style={styleFolderHeaderContainer}>
          <BackButton title={null} onClick={onBack} style={{marginLeft: globalMargins.small}} />
        </Box>
      ) : (
        <Box style={styleFolderHeaderContainer}>
          <Box style={folderHeaderStyleTree}>
            {dropdownPath !== '' && (
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
          <Box style={styleFolderHeaderEnd}>
            <Icon type="iconfont-finder" style={rowActionIconStyle} onClick={openInFileUI} />
          </Box>
        </Box>
      )}
    </Box>
    <ConnectedFilesBanner path={path} />
  </Box>
)

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleHeaderContainer = {
  ...globalStyles.flexBoxColumn,
}

const styleFolderHeader = {
  ...stylesCommonRow,
  justifyContent: 'center',
  minHeight: isMobile ? 64 : 48,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  justifyContent: 'center',
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
}

const styleFolderHeaderEnd = {
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

const styleFolderHeaderContainer = {
  ...stylesCommonRow,
  justifyContent: 'space-between',
  flex: 1,
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

const rowActionIconStyle = {
  color: globalColors.black_40,
  fontSize: 16,
}

export default FolderHeader
