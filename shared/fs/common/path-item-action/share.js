// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import type {FloatingMenuProps} from './types'
import DownloadTrackingHoc from '../download-tracking-hoc'
import Header from './header-container'

type Props = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  // Menu items
  confirmSaveMedia?: () => void,
  confirmShareNative?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
|}

const ShareNative = DownloadTrackingHoc<{||}>(({downloading}) =>
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

const Save = DownloadTrackingHoc<{||}>(({downloading}) =>
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
    ...(props.confirmSaveMedia
      ? [
          {
            onClick: props.confirmSaveMedia,
            title: 'Save',
          },
        ]
      : []),
    ...(props.confirmShareNative
      ? [
          {
            onClick: props.confirmShareNative,
            title: 'Send to other app',
          },
        ]
      : []),
    ...(props.saveMedia
      ? [
          {
            disabled: props.saveMedia === 'disabled',
            onClick: props.saveMedia !== 'disabled' ? props.saveMedia : undefined,
            title: 'Save',
            view: (
              <Save
                trackingPath={props.path}
                trackingIntent="camera-roll"
                onFinish={hideMenu}
                cancelOnUnmount={true}
              />
            ),
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
      view: <Header path={props.path} />,
    }}
    items={makeMenuItems(props, props.floatingMenuProps.hideOnce)}
  />
)

const styles = Styles.styleSheetCreate({
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
