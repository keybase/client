// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import type {FloatingMenuProps} from './types'
import DownloadTrackingHoc from '../download-tracking-hoc'
import Header from './header-container'

type Props = {|
  action: Types.PathItemActionMenuConfirmActionType,
  confirm: (() => void) | 'disabled',
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
|}

const Confirm = DownloadTrackingHoc<{|
  action: Types.PathItemActionMenuConfirmActionType,
|}>(({action, downloading}) =>
  downloading ? (
    <Kb.Box2 direction="horizontal">
      <Kb.ProgressIndicator style={styles.progressIndicator} />
      <Kb.Text type="BodyBig" style={styles.menuRowTextDisabled}>
        {action === 'save' ? 'Saving' : 'Preparing to send to other app'}
      </Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Text type="BodyBig" style={styles.menuRowText}>
      Confirm
    </Kb.Text>
  )
)

const ConfirmHeader = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Header path={props.path} />
    <Kb.Box2 style={styles.confirmTextBox} direction="horizontal" fullWidth={true} centerChildren={true}>
      <Kb.Text type="Body" style={styles.confirmText}>
        {props.action === 'save'
          ? 'This file is larger than 50 MB. Continue to save?'
          : 'This file is larger than 50 MB and we need to download it first. Continue to share?'}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

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
      view: <ConfirmHeader {...props} />,
    }}
    items={
      props.confirm
        ? [
            {
              disabled: props.confirm === 'disabled',
              onClick: props.confirm !== 'disabled' ? props.confirm : undefined,
              title: 'Confirm',
              view: (
                <Confirm
                  trackingPath={props.path}
                  trackingIntent={props.action === 'save' ? 'camera-roll' : 'share'}
                  onFinish={props.floatingMenuProps.hideOnce}
                  cancelOnUnmount={true}
                  action={props.action}
                />
              ),
            },
          ]
        : []
    }
  />
)

const styles = Styles.styleSheetCreate({
  confirmText: {
    textAlign: 'center',
  },
  confirmTextBox: {
    padding: Styles.globalMargins.medium,
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
