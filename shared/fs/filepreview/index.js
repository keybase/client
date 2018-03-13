// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {formatTimeForMessages} from '../../util/timestamp'
import FolderHeader from '../header/header-container'

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

const humanReadableFileSize = meta => {
  const kib = 1024
  const mib = kib * kib
  const gib = mib * kib
  const tib = gib * kib

  if (!meta) return ''
  const size = meta.size
  if (size >= tib) return `${Math.round(size / tib)}tb`
  if (size >= gib) return `${Math.round(size / gib)}gb`
  if (size >= mib) return `${Math.round(size / mib)}mb`
  if (size >= kib) return `${Math.round(size / kib)}kb`
  return '' + size
}

class FilePreview extends React.PureComponent<FilePreviewProps> {
  render() {
    const {path, meta} = this.props
    const fileName = Types.getPathName(path)
    let desc = 'loading'
    if (meta) {
      desc = 'Modified on ' + formatTimeForMessages(meta.lastModifiedTimestamp)
      if (meta.lastWriter) desc += ' by ' + meta.lastWriter
    }
    // FIXME is using FolderHeader instead of BackButton ok?
    // <BackButton onClick={onBack} style={{left: 16, position: 'absolute', top: 16}} />
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
