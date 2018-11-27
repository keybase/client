// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {fileUIName} from '../../constants/platform'
import {
  Box2,
  Box,
  ClickableBox,
  ProgressIndicator,
  Icon,
  Text,
  FloatingMenu,
  iconCastPlatformStyles,
  type OverlayParentProps,
} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'
import StaticBreadcrumb from '../common/static-breadcrumb'
import {memoize} from 'lodash-es'
import DownloadTrackingHoc from './download-tracking-hoc'

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
  actionIconWhite?: boolean,
  path: Types.Path,
  pathElements: Array<string>,
  // Menu items
  showInSystemFileManager?: () => void,
  ignoreFolder?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
  download?: () => void,
  copyPath?: () => void,
  deleteFileOrFolder?: () => void,
  moveOrCopy?: () => void,
}

const hideMenuOnClick = (onClick: (evt?: SyntheticEvent<>) => void, hideMenu: () => void) => (
  evt?: SyntheticEvent<>
) => {
  onClick(evt)
  hideMenu()
}

const ShareNative = DownloadTrackingHoc(({downloading}) =>
  downloading ? (
    <Box2 direction="horizontal">
      <ProgressIndicator style={styles.progressIndicator} />
      <Text type="BodyBig" style={styles.menuRowTextDisabled}>
        Preparing to send to other app
      </Text>
    </Box2>
  ) : (
    <Text type="BodyBig" style={styles.menuRowText}>
      Send to other app
    </Text>
  )
)

const Save = DownloadTrackingHoc(({downloading}) =>
  downloading ? (
    <Box2 direction="horizontal">
      <ProgressIndicator style={styles.progressIndicator} />
      <Text type="BodyBig" style={styles.menuRowTextDisabled}>
        Saving
      </Text>
    </Box2>
  ) : (
    <Text type="BodyBig" style={styles.menuRowText}>
      Save
    </Text>
  )
)

const makeMenuItems = (props: Props, hideMenu: () => void) => {
  return [
    ...(props.saveMedia
      ? [
          {
            title: 'Save',
            view: <Save trackingPath={props.path} trackingIntent="camera-roll" />,
            onClick: props.saveMedia !== 'disabled' ? hideMenuOnClick(props.saveMedia, hideMenu) : undefined,
            disabled: props.saveMedia === 'disabled',
          },
        ]
      : []),
    ...(props.shareNative
      ? [
          {
            title: 'Send to other app',
            view: (
              <ShareNative
                trackingPath={props.path}
                trackingIntent="share"
                onFinish={hideMenu}
                cancelOnUnmount={true}
              />
            ),
            onClick: props.shareNative !== 'disabled' ? props.shareNative : undefined,
            disabled: props.shareNative === 'disabled',
          },
        ]
      : []),
    ...(props.showInSystemFileManager
      ? [
          {
            title: 'Show in ' + fileUIName,
            onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
          },
        ]
      : []),
    ...(props.copyPath
      ? [
          {
            title: 'Copy path',
            onClick: hideMenuOnClick(props.copyPath, hideMenu),
          },
        ]
      : []),
    ...(props.download
      ? [
          {
            title: 'Download a copy',
            onClick: hideMenuOnClick(props.download, hideMenu),
          },
        ]
      : []),
    ...(props.ignoreFolder
      ? [
          {
            title: 'Ignore this folder',
            onClick: hideMenuOnClick(props.ignoreFolder, hideMenu),
            subTitle: 'The folder will no longer appear in your folders list.',
            danger: true,
          },
        ]
      : []),
    ...(props.moveOrCopy
      ? [
          {
            title: 'Move or Copy',
            onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
          },
        ]
      : []),
    ...(props.type === 'file' && props.deleteFileOrFolder
      ? [
          {
            title: 'Delete',
            danger: true,
            onClick: hideMenuOnClick(props.deleteFileOrFolder, hideMenu),
          },
        ]
      : []),
  ]
}

const PathItemActionHeader = (props: Props) => (
  <Box style={styles.header}>
    <PathItemIcon spec={props.itemStyles.iconSpec} style={styles.pathItemIcon} />
    <StaticBreadcrumb pathElements={props.pathElements} />
    <Box style={styles.nameTextBox}>
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

const PathItemAction = (props: Props & OverlayParentProps) => {
  const hideMenuOnce = (() => {
    let hideMenuCalled = false
    return () => {
      if (hideMenuCalled) {
        return
      }
      hideMenuCalled = true
      props.toggleShowingMenu()
    }
  })()

  return (
    <Box>
      <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
        <Icon
          type="iconfont-ellipsis"
          color={props.actionIconWhite ? Styles.globalColors.white : Styles.globalColors.black_40}
          style={iconCastPlatformStyles(styles.actionIcon)}
          fontSize={props.actionIconFontSize}
          className={props.actionIconClassName}
        />
      </ClickableBox>
      <FloatingMenu
        closeOnSelect={false}
        containerStyle={styles.floatingContainer}
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        onHidden={hideMenuOnce}
        position="bottom right"
        header={{
          title: 'unused',
          view: <PathItemActionHeader {...props} />,
        }}
        items={makeMenuItems(props, hideMenuOnce)}
      />
    </Box>
  )
}

const styles = Styles.styleSheetCreate({
  nameTextBox: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {
      textAlign: 'center',
    },
  }),
  pathItemIcon: {
    marginBottom: Styles.globalMargins.xtiny,
  },
  floatingContainer: Styles.platformStyles({
    common: {
      overflow: 'visible',
    },
    isElectron: {
      width: 220,
      marginTop: 12,
    },
    isMobile: {
      width: '100%',
      marginTop: undefined,
    },
  }),
  header: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      width: '100%',
      alignItems: 'center',
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.large,
    },
  }),
  actionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  menuRowText: {
    color: Styles.globalColors.blue,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blue,
    opacity: 0.6,
  },
  progressIndicator: {
    marginRight: Styles.globalMargins.xtiny,
  },
})

const stylesNameText = memoize(color =>
  Styles.platformStyles({
    common: {
      color,
    },
    isElectron: {
      overflowWrap: 'break-word',
      textAlign: 'center',
    },
  })
)

export default PathItemAction
