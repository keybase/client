// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import type {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import DownloadTrackingHoc from '../download-tracking-hoc'
import RootHeader from './root-header-container'

type Props = {|
  floatingMenuProps: FloatingMenuProps,
  onHidden: () => void,
  path: Types.Path,
  // Menu items
  showInSystemFileManager?: () => void,
  ignoreFolder?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
  download?: () => void,
  copyPath?: () => void,
  deleteFileOrFolder?: () => void,
  moveOrCopy?: () => void,
|}

const hideMenuOnClick = (onClick: (evt?: SyntheticEvent<>) => void, hideMenu: () => void) => (
  evt?: SyntheticEvent<>
) => {
  onClick(evt)
  hideMenu()
}

const ShareNative = DownloadTrackingHoc(({downloading}) =>
  downloading ? (
    <Kb.Box2 direction="horizontal">
      <Kb.ProgressIndicator style={styles.progressIndicator} />
      <Kb.Text type="BodyBig" style={styles.menuRowTextDisabled}>
        Preparing to send to other app
      </Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Text type="BodyBig" style={styles.menuRowText}>
      Send to other app
    </Kb.Text>
  )
)

const Save = DownloadTrackingHoc(({downloading}) =>
  downloading ? (
    <Kb.Box2 direction="horizontal">
      <Kb.ProgressIndicator style={styles.progressIndicator} />
      <Kb.Text type="BodyBig" style={styles.menuRowTextDisabled}>
        Saving
      </Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Text type="BodyBig" style={styles.menuRowText}>
      Save
    </Kb.Text>
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
    ...(props.deleteFileOrFolder
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

export default (props: Props) => (
  <Kb.FloatingMenu
    closeOnSelect={false}
    containerStyle={props.floatingMenuProps.containerStyle}
    attachTo={props.floatingMenuProps.attachTo}
    visible={props.floatingMenuProps.visible}
    onHidden={props.floatingMenuProps.hideOnce}
    position="bottom right"
    header={{
      title: 'unused',
      view: <RootHeader path={props.path} />,
    }}
    items={makeMenuItems(props, props.floatingMenuProps.hideOnce)}
  />
)

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
