// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'
import {PathItemInfo, PathItemIcon} from '../common'
import {memoize} from 'lodash-es'
import {fileUIName, isMobile, isIOS} from '../../constants/platform'

type DefaultViewProps = {
  fileUIEnabled: boolean,
  path: Types.Path,
  pathItem: Types.PathItem,

  download: () => void,
  saveMedia: () => void,
  shareNative: () => void,
  showInSystemFileManager: () => void,
}

const DefaultView = (props: DefaultViewProps) => (
  <Box style={stylesContainer}>
    <PathItemIcon path={props.path} size={32} />
    <Text type="BodyBig" style={stylesFilename(Constants.getPathTextColor(props.path))}>
      {props.pathItem.name}
    </Text>
    <Text type="BodySmall">{Constants.humanReadableFileSize(props.pathItem.size)}</Text>
    {isMobile && <PathItemInfo path={props.path} startWithLastModified={true} />}
    {props.pathItem.type === 'symlink' && (
      <Text type="BodySmall" style={stylesSymlink}>
        {'This is a symlink' + (props.pathItem.linkTarget ? ` to: ${props.pathItem.linkTarget}.` : '.')}
      </Text>
    )}
    {isMobile && (
      <Text type="BodySmall" style={stylesNoOpenMobile}>
        This document can not be opened on mobile. You can still interact with it using the ••• menu.
      </Text>
    )}
    {// Enable this button for desktop when we have in-app sharing.
    isMobile && (
      <Button
        key="share"
        type="Primary"
        label="Share"
        style={{marginTop: globalMargins.medium}}
        onClick={props.shareNative}
      />
    )}
    {!isIOS &&
      (props.fileUIEnabled ? (
        <Button
          key="open"
          type="Secondary"
          label={'Show in ' + fileUIName}
          style={{marginTop: globalMargins.small}}
          onClick={props.showInSystemFileManager}
        />
      ) : (
        <Button
          key="download"
          type="Secondary"
          label="Download a copy"
          style={{marginTop: globalMargins.small}}
          onClick={props.download}
        />
      ))}
  </Box>
)

const stylesContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    alignItems: 'center',
    backgroundColor: globalColors.white,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  isElectron: {
    marginBottom: globalMargins.medium,
    marginTop: globalMargins.medium,
  },
  isMobile: {
    marginTop: 32,
    paddingLeft: 40,
    paddingRight: 40,
  },
})

const stylesFilename = memoize(color => ({
  color: color,
  marginBottom: globalMargins.tiny,
  marginTop: globalMargins.small,
}))

const stylesSymlink = {
  marginTop: globalMargins.medium,
}

const stylesNoOpenMobile = {
  marginTop: globalMargins.medium,
  textAlign: 'center',
}

export default DefaultView
