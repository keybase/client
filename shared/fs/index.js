// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, Button, ClickableBox, Icon, List, Text} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 48,
  padding: 8,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
}

// TODO: derive this from the Redux store.
const rootFolders = [
  'private',
  'public',
  'team',
]

type FolderHeaderProps = {
  title: string,
}

type FileRowProps = {
  path: string,
  icon: IconType,
  showFileData: () => void,
}

type FolderProps = {
  path: string,
  visibility: Types.FolderVisibility,
  items: Array<string>,
}

const FolderHeader = ({title}: FolderHeaderProps) => (
  <Box>
    <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
      <Text type="HeaderBig" style={{padding: globalMargins.xtiny}}>
        {title}
      </Text>
    </Box>
  </Box>
)

const FolderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'stretch'}

const FileRow = ({path, icon, showFileData}: FileRowProps) => (
  <ClickableBox onClick={showFileData} style={{...stylesCommonRow}}>
    <Box key={path} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={{marginRight: globalMargins.small}} />
      <Box style={FolderBoxStyle}>
        <Text type="Body">
          {path}
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

const iconTypes : IconType = {
  folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
  file: isMobile ? 'icon-file-24' : 'icon-file-24',
}

class Folder extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => {
    const showFileData = () => null
    const iconType = iconTypes[item.type]
    const path = this.props.path + '/' + item.key
    return (
      <FileRow path={path} icon={iconType} showFileData={showFileData} />
    )
  }

  render() {
    return (
      <Box style={stylesContainer}>
        <FolderHeader title="Folders" />
        <List items={this.props.items} renderItem={this._renderRow} />
      </Box>
    )
  }
}

const Fs = () => (
  <Folder path='/keybase' items={rootFolders.map(name => ({key: name, visibility: name, type: 'folder'}))} />
)

export default Fs
