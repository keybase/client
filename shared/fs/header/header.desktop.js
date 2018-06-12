// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import ConnectedFilesBanner from '../banner/container'
import AddNew from './add-new-container'

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
      ) : (
        <Box style={styleFolderHeaderContainer}>
          <Box style={folderHeaderStyleTree}>
            {!!dropdownPath && (
              <Box style={folderBreadcrumbStyle}>
                <ClickableBox style={styleBreadcrumbDropdownIconBox} onClick={onOpenBreadcrumbDropdown}>
                  <Icon type="iconfont-folder-dropdown" style={styleBreadcrumbDropdownIcon} fontSize={16} />
                </ClickableBox>
                <Icon type="iconfont-arrow-right" style={iconStyle} fontSize={11} />
              </Box>
            )}
            {breadcrumbItems.map(i => (
              <Box
                key={Types.pathToString(i.path)}
                style={i.isLastItem ? lastFolderBreadcrumbStyle : folderBreadcrumbStyle}
              >
                {i.isTlfNameItem &&
                  isTeamPath && <Avatar size={16} teamname={i.name} isTeam={true} style={styleTeamAvatar} />}
                {i.isLastItem ? (
                  <Text type="BodyBig" style={stylesLastNameText}>
                    {i.name}
                  </Text>
                ) : (
                  <Box style={folderBreadcrumbStyle}>
                    <ClickableBox onClick={i.onOpenBreadcrumb}>
                      <Text type="BodySmallSemibold" style={styleParentBreadcrumb}>
                        {i.name}
                      </Text>
                    </ClickableBox>
                    <Icon type="iconfont-arrow-right" style={iconStyle} fontSize={11} />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
          <Box style={styleFolderHeaderEnd}>
            <AddNew path={path} style={styleAddNew} />
            <Icon type="iconfont-finder" color={globalColors.black_40} fontSize={16} onClick={openInFileUI} />
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
  minHeight: 48,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  justifyContent: 'center',
  width: '100%',
  height: 48,
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'flex-start',
  paddingLeft: 16,
  paddingRight: 16,
}

const styleFolderHeaderEnd = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
  flexShrink: 0,
}

const folderBreadcrumbStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 0,
  paddingRight: 0,
  flexShrink: 0,
}

const lastFolderBreadcrumbStyle = {
  ...folderBreadcrumbStyle,
  flexShrink: 1,
}

const stylesLastNameText = platformStyles({
  isElectron: {
    overflowWrap: 'break-word',
  },
})

const styleFolderHeaderContainer = {
  ...stylesCommonRow,
  justifyContent: 'space-between',
  marginTop: 15,
  marginBottom: 15,
  alignItems: 'flex-start',
}

const styleParentBreadcrumb = {
  color: globalColors.black_60,
}

const iconStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const styleBreadcrumbDropdownIcon = {
  ...iconStyle,
  marginLeft: 0,
}

const styleBreadcrumbDropdownIconBox = {
  marginTop: 2,
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

const styleAddNew = {
  marginRight: globalMargins.small,
}

export default FolderHeader
