// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'
import PathItemInfo from '../common/path-item-info'
import PathItemIcon from '../common/path-item-icon'
import memoize from 'lodash/memoize'
import {fileUIName, isMobile} from '../../constants/platform'

type DefaultViewProps = {
  fileUIEnabled: boolean,
  itemStyles: Types.ItemStyles,
  pathItem: Types.PathItem,

  onDownload: () => void,
  onSave: () => void,
  onShare: () => void,
  onOpenAsText: () => void,
  onShowInFileUI: () => void,
}

const DefaultView = (props: DefaultViewProps) => (
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
        onClick={props.onShare}
      />
    )}
    {props.fileUIEnabled ? (
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
)

const stylesContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: globalColors.white,
  },
  isMobile: {
    marginTop: 32,
  },
  isElectron: {
    marginTop: globalMargins.medium,
    marginBottom: globalMargins.medium,
  },
})

const stylesFilename = memoize(color => ({
  marginTop: globalMargins.small,
  marginBottom: globalMargins.tiny,
  color: color,
}))

const stylesSymlink = {
  marginTop: globalMargins.medium,
}

const stylesNoOpenMobile = {
  marginTop: globalMargins.medium,
  width: 295,
}

export default DefaultView
