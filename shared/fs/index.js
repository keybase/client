// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Avatar, Box, ClickableBox, Icon, List, Text, Divider} from '../common-adapters'
import RowConnector from './row'
import FolderHeader from './header/header-container'
import SortBar from './sortbar/container'

type FileRowProps = {
  elems: Array<string>,
  name: string,
  path: Types.Path,
  type: Types.PathType,
  itemStyles: Types.ItemStyles,
  onOpen: () => void,
  visibility: Types.Visibility,
}

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  progress: 'pending' | 'loaded',
  sortSetting: Types._SortSetting,
}

const FileRow = RowConnector(({elems, path, name, type, itemStyles, onOpen, visibility}: FileRowProps) => (
  <Box>
    <ClickableBox onClick={onOpen} style={stylesCommonRow}>
      <Box style={stylesRowContainer}>
        <Box style={stylesRowBox}>
          {elems.length === 3 && visibility === 'team' ? (
            <Avatar size={32} teamname={name} isTeam={true} style={iconStyle} />
          ) : (
            <Box style={iconBoxStyle}>
              <Icon type={itemStyles.iconType} style={{color: itemStyles.iconColor, ...iconStyle}} />
            </Box>
          )}
          <Box style={folderBoxStyle}>
            <Text type={itemStyles.textType} style={{color: itemStyles.textColor}}>
              {name}
            </Text>
          </Box>
        </Box>
        {!isMobile &&
          type === 'folder' && (
            <Box style={stylesRowRightBox}>
              <Icon type="iconfont-finder" style={rowActionIconStyle} />
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
      <Icon type={rowPlaceholderIcon} style={iconStyle} />
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

const folderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'space-between'}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const iconStyle = {
  marginRight: globalMargins.small,
  fontSize: 30,
}

const rowActionIconStyle = {
  color: globalColors.black_40,
  fontSize: 16,
}

const iconBoxStyle = {
  marginTop: 3,
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
}

const stylesRowContainer = {
  ...stylesRowBox,
  justifyContent: 'space-between',
}

const stylesRowRightBox = {
  ...stylesRowBox,
  justifyContent: 'flex-end',
  flexShrink: 1,
  paddingRight: globalMargins.small,
}

export default Files
