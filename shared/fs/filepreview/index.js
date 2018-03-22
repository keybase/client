// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {humanReadableFileSize} from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {formatTimeForMessages} from '../../util/timestamp'
import FolderHeader from '../header/container'

type FilePreviewHeaderProps = {
  title: string,
  desc: string,
}

const FilePreviewHeader = ({title, desc}: FilePreviewHeaderProps) => (
  <Box>
    <Box style={filePreviewHeaderStyle}>
      <Text type="BodyBig">{title}</Text>
      <Text type="BodySmall">{desc}</Text>
    </Box>
  </Box>
)

type FilePreviewProps = {
  path: Types.Path,
  meta: Types.PathItemMetadata,
}

class FilePreview extends React.PureComponent<FilePreviewProps> {
  render() {
    const {path, meta} = this.props
    const fileName = Types.getPathName(path)
    let desc = 'loading'
    if (meta) {
      desc = 'Modified on ' + formatTimeForMessages(meta.lastModifiedTimestamp)
      if (meta.lastWriter.username) desc += ' by ' + meta.lastWriter.username
    }
    // Perhaps use PathItemIcon here later...
    return (
      <Box style={styleOuterContainer}>
        <Box style={globalStyles.flexBoxColumn}>
          <FolderHeader path={path} />
        </Box>
        <FilePreviewHeader title={fileName} desc={desc} />
        <Box style={stylesContainer}>
          <Icon type={iconTypeName} />
          <Text type="BodyBig" style={{marginTop: globalMargins.small}}>
            {fileName}
          </Text>
          <Text type="BodySmall">{humanReadableFileSize(meta)}</Text>
          <Button
            key="share"
            type="Primary"
            label="Share"
            style={{marginTop: globalMargins.medium}}
            onClick={notImplemented}
          />
          <Button
            key="open"
            type="Secondary"
            label="Open file"
            style={{marginTop: globalMargins.small}}
            onClick={notImplemented}
          />
        </Box>
      </Box>
    )
  }
}

const notImplemented = event => {
  console.log('Not implemented yet, FIXME')
}

const iconTypeName = 'icon-folder-private-48'

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonColumn = {
  ...globalStyles.flexBoxColumn,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 40,
}

const filePreviewHeaderStyle = {...stylesCommonColumn, alignItems: 'center', borderBottomWidth: 0}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}
const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

export default FilePreview
