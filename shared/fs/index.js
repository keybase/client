// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, BackButton, Button, ClickableBox, Icon, List, Text} from '../common-adapters'
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

const iconTypes : IconType = {
  folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
  file: isMobile ? 'icon-file-24' : 'icon-file-24',
}

type FolderHeaderProps = {
  title: string,
}

type FileRowProps = {
  name: string,
  path: Types.Path,
  type: Types.PathType,
  onViewFolder: (p: Path) => void,
  onViewFile: (p: Path) => void,
}

type FolderProps = {
  name: string,
  path: Types.Path,
  visibility: Types.Visibility,
  items: Array<string>,
  onViewFolder: (p: Path) => void,
  onViewFile: (p: Path) => void,
}

const FolderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'stretch'}

const styleOuterContainer = {
  position: 'relative',
  height: '100%',
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

const FileRow = ({name, path, type, onViewFolder, onViewFile}: FileRowProps) => (
  <ClickableBox key={name} onClick={type === 'folder' ? onViewFolder(path) : onViewFile(path)} style={{...stylesCommonRow}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={iconTypes[type]} style={{marginRight: globalMargins.small}} />
      <Box style={FolderBoxStyle}>
        <Text type="Body">
          {name}
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

export class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => (
    <FileRow name={item.name} path={item.path} type={item.type} onViewFolder={this.props.onViewFolder} onViewFile={this.props.onViewFile} />
  )

  render() {
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          {this.props.onBack && this.props.path !== '/keybase' && (
            <Box style={globalStyles.flexBoxColumn}>
                <BackButton
                  onClick={this.props.onBack}
                  style={{position:'absolute', left: 16, top: 16}}
                />
            </Box>
          )}
          <FolderHeader title={"Folders: " + this.props.path} />
          <List items={this.props.items} renderItem={this._renderRow} />
        </Box>
      </Box>
    )
  }
}

export default Files
