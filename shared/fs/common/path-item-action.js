// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../../styles'
import {fileUIName} from '../../constants/platform'
import {Box, ClickableBox, Icon, Text, FloatingMenu, type OverlayParentProps} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'
import StaticBreadcrumb from '../common/static-breadcrumb'
import {memoize} from 'lodash'

type Props = {
  name: string,
  size: number,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  childrenFolders: number,
  childrenFiles: number,
  itemStyles: Types.ItemStyles,
  actionIconClassName?: string,
  actionIconFontSize?: number,
  pathElements: Array<string>,
  // Menu items
  showInFileUI?: () => void,
  ignoreFolder?: () => void,
  saveMedia?: () => void,
  shareNative?: () => void,
  download?: () => void,
  copyPath?: () => void,
}

const makeMenuItems = (props: Props) => {
  return [
    ...(props.showInFileUI
      ? [
          {
            title: 'Show in ' + fileUIName,
            onClick: props.showInFileUI,
          },
        ]
      : []),
    ...(props.ignoreFolder
      ? [
          {
            title: 'Ignore this folder',
            onClick: props.ignoreFolder,
            subTitle: 'The folder will no longer appear in your folders list.',
            danger: true,
          },
        ]
      : []),
    ...(props.saveMedia
      ? [
          {
            title: 'Save',
            onClick: props.saveMedia,
          },
        ]
      : []),
    ...(props.shareNative
      ? [
          {
            title: 'Send to other app',
            onClick: props.shareNative,
          },
        ]
      : []),
    ...(props.download
      ? [
          {
            title: 'Download a copy',
            onClick: props.download,
          },
        ]
      : []),
    ...(props.copyPath
      ? [
          {
            title: 'Copy path',
            onClick: props.copyPath,
          },
        ]
      : []),
  ]
}

const PathItemActionHeader = (props: Props) => (
  <Box style={stylesHeader}>
    <PathItemIcon spec={props.itemStyles.iconSpec} style={pathItemIconStyle} />
    <StaticBreadcrumb pathElements={props.pathElements} />
    <Box style={stylesNameTextBox}>
      <Text selectable={true} type="BodySmallSemibold" style={stylesNameText(props.itemStyles.textColor)}>
        {props.name}
      </Text>
    </Box>
    {props.type === 'file' && <Text type="BodySmall">{Constants.humanReadableFileSize(props.size)}</Text>}
    {props.type === 'folder' && (
      <Text type="BodySmall">
        {props.childrenFolders
          ? `${props.childrenFolders} Folder${props.childrenFolders > 1 ? 's' : ''}${
              props.childrenFiles ? ', ' : ''
            }`
          : undefined}
        {props.childrenFiles ? `${props.childrenFiles} File${props.childrenFiles > 1 ? 's' : ''}` : undefined}
      </Text>
    )}
    <PathItemInfo
      lastModifiedTimestamp={props.lastModifiedTimestamp}
      lastWriter={props.lastWriter}
      wrap={true}
    />
  </Box>
)

const PathItemAction = (props: Props & OverlayParentProps) => (
  <Box>
    <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Icon
        type="iconfont-ellipsis"
        color={globalColors.black_40}
        style={actionIconStyle}
        fontSize={props.actionIconFontSize}
        className={props.actionIconClassName}
      />
    </ClickableBox>
    <FloatingMenu
      containerStyle={stylesFloatingContainer}
      attachTo={props.attachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      position="bottom right"
      closeOnSelect={true}
      header={{
        title: 'unused',
        view: <PathItemActionHeader {...props} />,
      }}
      items={makeMenuItems(props)}
    />
  </Box>
)

const stylesNameText = memoize(color =>
  platformStyles({
    common: {
      color,
    },
    isElectron: {
      overflowWrap: 'break-word',
      textAlign: 'center',
    },
  })
)

const stylesNameTextBox = platformStyles({
  common: {
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  isElectron: {
    textAlign: 'center',
  },
})

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
}

const stylesFloatingContainer = {
  width: isMobile ? '100%' : 220,
  overflow: 'visible',
  marginTop: isMobile ? undefined : 12,
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
  alignItems: 'center',
  paddingTop: globalMargins.small,
}

const actionIconStyle = {
  padding: globalMargins.tiny,
}

export default PathItemAction
