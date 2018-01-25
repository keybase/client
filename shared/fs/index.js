// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Box, BackButton, Button, ClickableBox, Icon, List, Text} from '../common-adapters'
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
  minHeight: isMobile ? 64 : 48,
  padding: 8,
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
  type: Types.PathType,
  icon: IconType,
  onOpen: () => void,
}

type FolderProps = {
  name: string,
  path: Types.Path,
  visibility: Types.Visibility,
  items: Array<string>,
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

const FileRow = RowConnector(({path, name, icon, onOpen}: FileRowProps) => (
  <ClickableBox onClick={onOpen} style={{...stylesCommonRow}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={{marginRight: globalMargins.small}} />
      <Box style={FolderBoxStyle}>
        <Text type="Body">
          {name}
        </Text>
      </Box>
    </Box>
  </ClickableBox>
))

const Files = ({path, items, onBack}: FolderProps) => (
  <Box style={styleOuterContainer}>
    <Box style={stylesContainer}>
      {onBack && path !== '/keybase' && (
        <Box style={globalStyles.flexBoxColumn}>
            <BackButton
              onClick={onBack}
              style={{position:'absolute', left: 16, top: 16}}
            />
        </Box>
      )}
      <FolderHeader title={"Folders: " + path} />
      <List items={items}
        renderItem={(index, item) => (<FileRow key={item} path={item} />)} />
    </Box>
  </Box>
)

export default Files
