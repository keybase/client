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
            disabled: props.saveMedia === 'disabled',
            onClick: props.saveMedia !== 'disabled' ? hideMenuOnClick(props.saveMedia, hideMenu) : undefined,
            title: 'Save',
            view: <Save trackingPath={props.path} trackingIntent="camera-roll" />,
          },
        ]
      : []),
    ...(props.shareNative
      ? [
          {
            disabled: props.shareNative === 'disabled',
            onClick: props.shareNative !== 'disabled' ? props.shareNative : undefined,
            title: 'Send to other app',
            view: (
              <ShareNative
                trackingPath={props.path}
                trackingIntent="share"
                onFinish={hideMenu}
                cancelOnUnmount={true}
              />
            ),
          },
        ]
      : []),
    ...(props.showInSystemFileManager
      ? [
          {
            onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
            title: 'Show in ' + fileUIName,
          },
        ]
      : []),
    ...(props.copyPath
      ? [
          {
            onClick: hideMenuOnClick(props.copyPath, hideMenu),
            title: 'Copy path',
          },
        ]
      : []),
    ...(props.download
      ? [
          {
            onClick: hideMenuOnClick(props.download, hideMenu),
            title: 'Download a copy',
          },
        ]
      : []),
    ...(props.ignoreFolder
      ? [
          {
            danger: true,
            onClick: hideMenuOnClick(props.ignoreFolder, hideMenu),
            subTitle: 'The folder will no longer appear in your folders list.',
            title: 'Ignore this folder',
          },
        ]
      : []),
    ...(props.moveOrCopy
      ? [
          {
            onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
            title: 'Move or Copy',
          },
        ]
      : []),
    ...(props.type === 'file' && props.deleteFileOrFolder
      ? [
          {
            danger: true,
            onClick: hideMenuOnClick(props.deleteFileOrFolder, hideMenu),
            title: 'Delete',
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
  actionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  floatingContainer: Styles.platformStyles({
    common: {
      overflow: 'visible',
    },
    isElectron: {
      marginTop: 12,
      width: 220,
    },
    isMobile: {
      marginTop: undefined,
      width: '100%',
    },
  }),
  header: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingTop: Styles.globalMargins.small,
      width: '100%',
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.large,
    },
  }),
  menuRowText: {
    color: Styles.globalColors.blue,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blue,
    opacity: 0.6,
  },
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
