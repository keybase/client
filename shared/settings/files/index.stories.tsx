import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Files, {defaultNotificationThreshold} from '.'
import * as Constants from '../../constants/fs'
import {bannerProvider} from '../../fs/banner/index.stories'
import {commonProvider} from '../../fs/common/index.stories'

const actions = {
  allowedThresholds: [],
  areSettingsLoading: false,
  humanizedNotificationThreshold: String(defaultNotificationThreshold),
  onChangedSyncNotifications: Sb.action('onChangedSyncNotifications'),
  onDisable: Sb.action('onDisable'),
  onDisableSyncNotifications: Sb.action('onDisableSyncNotifications'),
  onEnable: Sb.action('onEnable'),
  onEnableSyncNotifications: Sb.action('onEnableSyncNotifications'),
  onSetSyncNotificationThreshold: Sb.action('onSetSyncNotificationThreshold'),
  onShowKextPermissionPopup: Sb.action('onShowKextPermissionPopup'),
  spaceAvailableNotificationThreshold: 0,
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...bannerProvider,
})

const load = () => {
  Sb.storiesOf('Settings/Files', module)
    .addDecorator(provider)
    .add('Unknown', () => <Files {...actions} driverStatus={Constants.makeDriverStatusUnknown()} />)
    .add('Enabled', () => <Files {...actions} driverStatus={Constants.makeDriverStatusEnabled()} />)
    .add('Disabled', () => <Files {...actions} driverStatus={Constants.makeDriverStatusDisabled()} />)
    .add('Disabled - kext permission error', () => (
      <Files {...actions} driverStatus={Constants.makeDriverStatusDisabled({kextPermissionError: true})} />
    ))
    .add('Disabled - Enabling', () => (
      <Files {...actions} driverStatus={Constants.makeDriverStatusDisabled({isEnabling: true})} />
    ))
}

export default load
