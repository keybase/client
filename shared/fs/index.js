// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, ClickableBox, Icon, List, Text, Divider} from '../common-adapters'
import RowConnector from './row'
import FolderHeader from './header/header-container'
import SortBar from './sortbar/container'
import PathItemIcon from './path-item-icon'
import memoize from 'lodash/memoize'

type FileRowProps = {
  name: string,
  type: Types.PathType,
  itemStyles: Types.ItemStyles,
  onOpen: () => void,
  openInFileUI: () => void,
}

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  progress: 'pending' | 'loaded',
  sortSetting: Types._SortSetting,
}

const FileRow = RowConnector(({name, type, itemStyles, onOpen, openInFileUI}: FileRowProps) => (
  <Box>
    <ClickableBox onClick={onOpen} style={stylesCommonRow}>
      <Box style={stylesRowContainer}>
        <Box style={stylesRowBox}>
          <PathItemIcon spec={itemStyles.iconSpec} />
          <Box style={folderBoxStyle}>
            <Text type={itemStyles.textType} style={rowTextStyles(itemStyles.textColor)}>
              {name}
            </Text>
          </Box>
        </Box>
        {!isMobile &&
          type === 'folder' && (
            <Box style={stylesRowRightBox}>
              <Icon type="iconfont-finder" style={rowActionIconStyle} onClick={openInFileUI} />
            </Box>
          )}
      </Box>
    </ClickableBox>
    <Divider style={stylesRowDivider} />
  </Box>
))

const rowPlaceholderIcon = isMobile ? 'iconfont-folder-private' : 'iconfont-folder-private'
const placeholderTextStyle = {
  backgroundColor: globalColors.lightGrey,
  height: 16,
  marginTop: 4,
  width: 256,
}
const FileRowPlaceholder = () => (
  <Box style={stylesCommonRow}>
    <Box style={stylesRowBox}>
      <Icon type={rowPlaceholderIcon} style={iconPlaceholderIconStyle} />
      <Box style={folderBoxStyle}>
        <Box style={placeholderTextStyle} />
      </Box>
    </Box>
  </Box>
)

class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => <FileRow key={Types.pathToString(item)} path={item} />
  _renderRowPlaceholder = index => <FileRowPlaceholder key={index} />

  render() {
    const list =
      this.props.progress === 'pending' ? (
        <List items={['1', '2', '3']} renderItem={this._renderRowPlaceholder} />
      ) : (
        <List items={this.props.items} renderItem={this._renderRow} />
      )
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          <FolderHeader path={this.props.path} />
          <SortBar path={this.props.path} />
          {list}
        </Box>
      </Box>
    )
  }
}

const folderBoxStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  flex: 1,
  justifyContent: 'space-between',
  minWidth: 0,
}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const rowActionIconStyle = {
  color: globalColors.white,
  fontSize: 16,
  hoverColor: globalColors.black_40,
}

const stylesRowDivider = {
  marginLeft: isMobile ? 48 : 48,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: isMobile ? 64 : 40,
  paddingLeft: globalMargins.small,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
}

const stylesRowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
}

const stylesRowContainer = {
  ...stylesRowBox,
  justifyContent: 'space-between',
  paddingRight: globalMargins.small,
}

const stylesRowRightBox = {
  ...globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
}

const iconPlaceholderIconStyle = {
  marginRight: globalMargins.small,
  fontSize: 32,
}

const rowTextStyles = memoize(color => ({
  color,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}))

export default Files
