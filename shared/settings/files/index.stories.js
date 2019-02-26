// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Files from '.'
import * as Constants from '../../constants/fs'
import {bannerProvider} from '../../fs/banner/index.stories'
import {commonProvider} from '../../fs/common/index.stories'

const actions = {
  onDisable: Sb.action('onDisable'),
  onEnable: Sb.action('onEnable'),
  onShowKextPermissionPopup: Sb.action('onShowKextPermissionPopup'),
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
    .add('Disabled - kext permsisoin error', () => (
      <Files {...actions} driverStatus={Constants.makeDriverStatusDisabled({kextPermissionError: true})} />
    ))
    .add('Disabled - Enablnig', () => (
      <Files {...actions} driverStatus={Constants.makeDriverStatusDisabled({isEnabling: true})} />
    ))
}

export default load
