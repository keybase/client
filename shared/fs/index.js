// @flow
import React, {PureComponent} from 'react'
import {FolderVisibility} from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {isMobile} from '../constants/platform'
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
  visibility: FolderVisibility,
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


const FileRow = ({path, icon, showFileData}: FileRowProps) => (
  <ClickableBox onClick={showFileData} style={{...stylesCommonRow}}>
    <Box key={path} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={{marginRight: 16}} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text type="Body" style={{flex: 1}}>
          {path}
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

class Folder extends PureComponent<FolderProps> {
  _renderRow(index, item) {
    return (
      <FileRow path={item.path} icon={item.icon} showFileData={item.showFileData} />
    )
  }

  render() {
    const iconTypes : IconType = {
      folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
      file: isMobile ? 'icon-file-24' : 'icon-file-24',
    }
    const items = [
      ...this.props.items.map(({name, visibility, type}) => ({
        visibility, type,
        key: name,
        path: this.props.path + '/' + name,
        icon: iconTypes[type],
        // TODO: do something with path
        showFileData: () => null,
        })),
    ]
    return (
      <Box style={stylesContainer}>
        <FolderHeader title="Folders" />
        <List items={items} renderItem={this._renderRow} />
      </Box>
    )
  }
}

const Fs = () => (
  <Folder path='/keybase' items={rootFolders.map(name => ({name, visibility: name, type: 'folder'}))} />
)

export default Fs
