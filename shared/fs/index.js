// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, BackButton, ClickableBox, Icon, List, Text} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'
import {RowConnector} from './row'

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 40,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
}

type FolderHeaderProps = {
  title: string,
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
  onBack: () => void,
}

const folderBoxStyle = {...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'stretch'}

const folderHeaderStyle = {...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const FolderHeader = ({title}: FolderHeaderProps) => (
  <Box>
    <Box style={{...folderHeaderStyle}}>
      <Text type="BodyBig">{title}</Text>
    </Box>
  </Box>
)

const FileRow = RowConnector(({path, name, icon, onOpen}: FileRowProps) => (
  <ClickableBox onClick={onOpen} style={{...stylesCommonRow}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={{marginRight: globalMargins.small}} />
      <Box style={folderBoxStyle}>
        <Text type="Body">{name}</Text>
      </Box>
    </Box>
  </ClickableBox>
))

class Files extends React.PureComponent<FolderProps> {
  _renderRow = (index, item) => <FileRow key={Types.pathToString(item)} path={item} />

  render() {
    const onBack = this.props.onBack
    const path = this.props.path
    const items = this.props.items
    return (
      <Box style={styleOuterContainer}>
        <Box style={stylesContainer}>
          {onBack &&
            Types.pathToString(path) !== '/keybase' && (
              <Box style={globalStyles.flexBoxColumn}>
                <BackButton onClick={onBack} style={{left: 16, position: 'absolute', top: 16}} />
              </Box>
            )}
          <FolderHeader title={'Folders: ' + Types.pathToString(path)} />
          <List items={items} renderItem={this._renderRow} />
        </Box>
      </Box>
    )
  }
}

export default Files
