// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, ClickableBox, Icon, List, Text} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'
import RowConnector from './row'
import FolderHeader from './header'

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
  minHeight: isMobile ? 64 : 40,
  paddingLeft: 16,
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

type FileRowProps = {
  name: string,
  path: Types.Path,
  icon: IconType,
  onOpen: () => void,
}

type FolderProps = {
  items: Array<Types.Path>,
  path: Types.Path,
  progress: 'pending' | 'loaded',
}

const folderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'stretch'}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const iconStyle = {marginRight: globalMargins.small}

const FileRow = RowConnector(({path, name, icon, onOpen}: FileRowProps) => (
  <ClickableBox onClick={onOpen} style={stylesCommonRow}>
    <Box style={stylesRowBox}>
      <Icon type={icon} style={iconStyle} />
      <Box style={folderBoxStyle}>
        <Text type="Body">{name}</Text>
      </Box>
    </Box>
  </ClickableBox>
))

const rowPlaceholderIcon = isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24'
const placeholderTextStyle = {
  width: '256px',
  backgroundColor: 'lightGrey',
  height: '16px',
  marginTop: '4px',
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
  _renderRowPlaceholder = () => <FileRowPlaceholder />

  render() {
    const {path, items, progress} = this.props
    const list =
      progress === 'pending' ? (
        <List items={[null, null, null]} renderItem={this._renderRowPlaceholder} />
      ) : (
        <List items={items} renderItem={this._renderRow} />
      )
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          <FolderHeader path={path} />
          {list}
        </Box>
      </Box>
    )
  }
}

export default Files
