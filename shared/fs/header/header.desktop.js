// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import AddNew from './add-new-container'
import ConnectedBanner from '../banner/container'

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
            {breadcrumbItems.map((item, idxItem) => (
              <React.Fragment key={item.name}>
                {item.isTlfNameItem &&
                  isTeamPath && (
                    <Avatar size={16} teamname={item.name} isTeam={true} style={styleTeamAvatar} />
                  )}
                {!item.isLastItem ? (
                  <Box style={stylesBreadcrumbNonLastItemBox}>
                    <Text key={idxItem} onClick={item.onOpenBreadcrumb} type="BodySmallSemibold">
                      {item.name}
                    </Text>
                  </Box>
                ) : (
                  <Box style={stylesBreadcrumbLastItemBox}>
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
                  </Box>
                )}
                {!item.isLastItem && <Icon type="iconfont-arrow-right" style={iconStyle} fontSize={11} />}
              </React.Fragment>
            ))}
          </Box>
          <Box style={styleFolderHeaderEnd}>
            <AddNew path={path} style={styleAddNew} />
            <Icon type="iconfont-finder" color={globalColors.black_40} fontSize={16} onClick={openInFileUI} />
          </Box>
        </Box>
      )}
    </Box>
    <ConnectedBanner path={path} />
  </Box>
)

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleHeaderContainer = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
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
  left: 0,
  right: 0,
  flexGrow: 1,
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
  flexWrap: 'wrap',
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

const styleFolderHeaderContainer = {
  ...stylesCommonRow,
  position: 'relative',
  marginTop: 15,
  marginBottom: 15,
  alignItems: 'flex-start',
}

const stylesBreadcrumbNonLastItemBox = {
  maxWidth: 120,
  flexShrink: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: globalColors.black_60,
  whiteSpace: 'nowrap',
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
  flexShrink: 0,
}

export default FolderHeader
