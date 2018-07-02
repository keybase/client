// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Icon, Text} from '../../common-adapters'
import AddNew from './add-new-container'
import ConnectedBanner from '../banner/container'
import Breadcrumb from './breadcrumb-container.desktop'

export type FolderHeaderProps = {
  path: Types.Path,
  openInFileUI: () => void,
  onChat: () => void,
}

const FolderHeader = ({path, openInFileUI, onChat}: FolderHeaderProps) => (
  <Box style={styleHeaderContainer}>
    <Box style={styleFolderHeader}>
      {path === '/keybase' ? (
        <Box style={folderHeaderStyleRoot}>
          <Text type="BodyBig">Keybase Files</Text>
        </Box>
      ) : (
        <Box style={styleFolderHeaderContainer}>
          <Breadcrumb path={path} />
          <Box style={styleFolderHeaderEnd}>
            <AddNew path={path} style={styleAddNew} />
            <Icon type="iconfont-finder" color={globalColors.black_40} fontSize={16} onClick={openInFileUI} />
            {onChat && (
              <Icon
                type="iconfont-chat"
                style={{
                  marginLeft: globalMargins.small,
                }}
                color={globalColors.black_40}
                fontSize={16}
                onClick={onChat}
              />
            )}
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

const styleFolderHeaderEnd = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
  flexShrink: 0,
}

const styleFolderHeaderContainer = {
  ...stylesCommonRow,
  position: 'relative',
  marginTop: 15,
  marginBottom: 15,
  alignItems: 'flex-start',
}

const styleAddNew = {
  marginRight: globalMargins.small,
  flexShrink: 0,
}

export default FolderHeader
