// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Button, Text, BackButton} from '../../common-adapters'
import PathItemInfo from '../common/path-item-info'
import PathItemIcon from '../common/path-item-icon'
import Footer from '../footer/container'
import memoize from 'lodash/memoize'
import {fileUIName, isMobile, isIOS} from '../../constants/platform'
import renderFileTypeSpecial from './view-file'
import type {FilePreviewProps} from './common'

const FilePreview = (props: FilePreviewProps) => (
  <Box style={styleOuterContainer}>
    <Box style={globalStyles.flexBoxRow}>
      <BackButton key="back" onClick={props.onBack} style={stylesClose} />
      <Box style={filePreviewHeaderStyle}>
        <Text type="BodyBig">{props.pathItem.name}</Text>
        {!isMobile && (
          <PathItemInfo
            lastModifiedTimestamp={props.pathItem.lastModifiedTimestamp}
            lastWriter={props.pathItem.lastWriter.username}
            startWithLastModified={true}
          />
        )}
      </Box>
    </Box>
    <Box style={stylesGreyContainer}>
      <Box style={stylesContainer}>
        <PathItemIcon spec={props.itemStyles.iconSpec} style={{}} />
        <Text type="BodyBig" style={stylesFilename(props.itemStyles.textColor)}>
          {props.pathItem.name}
        </Text>
        <Text type="BodySmall">{Constants.humanReadableFileSize(props.pathItem.size)}</Text>
        {isMobile && (
          <PathItemInfo
            lastModifiedTimestamp={props.pathItem.lastModifiedTimestamp}
            lastWriter={props.pathItem.lastWriter.username}
            startWithLastModified={true}
          />
        )}
        {renderFileTypeSpecial(props)}
        {// Enable this button for desktop when we have in-app sharing.
        isMobile && (
          <Button
            key="share"
            type="Primary"
            label="Share"
            style={{marginTop: globalMargins.medium}}
            onClick={props.onShare}
          />
        )}
        {isIOS ? (
          Constants.isMedia(props.pathItem.name) && (
            <Button
              key="open"
              type="Secondary"
              label={'Save'}
              style={{marginTop: globalMargins.small}}
              onClick={props.onSave}
            />
          )
        ) : props.fileUIEnabled ? (
          <Button
            key="open"
            type="Secondary"
            label={'Show in ' + fileUIName}
            style={{marginTop: globalMargins.small}}
            onClick={props.onShowInFileUI}
          />
        ) : (
          <Button
            key="download"
            type="Secondary"
            label="Download a copy"
            style={{marginTop: globalMargins.small}}
            onClick={props.onDownload}
          />
        )}
      </Box>
    </Box>
    <Footer />
  </Box>
)

const stylesClose = {
  marginLeft: globalMargins.tiny,
}

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

const filePreviewHeaderStyle = {
  ...stylesCommonColumn,
  ...globalStyles.flexGrow,
  alignItems: 'center',
  borderBottomWidth: 0,
  height: 48,
}

const stylesGreyContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: globalColors.blue5,
  ...(isMobile
    ? {
        paddingTop: 32,
      }
    : {
        padding: globalMargins.medium,
      }),
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  width: '100%',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: globalColors.white,
}

const styleOuterContainer = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  position: 'relative',
}

const stylesFilename = memoize(color => ({
  marginTop: globalMargins.small,
  marginBottom: globalMargins.tiny,
  color: color,
}))

export default FilePreview
