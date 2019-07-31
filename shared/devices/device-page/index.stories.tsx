import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Sb from '../../stories/storybook'
import DevicePage from './container'

const makeDevice = (options: any) => {
  const {revoked, type, current, lastUsed = true} = options
  return Constants.makeDevice({
    created: new Date('2002-10-09T01:23:45').getTime(),
    currentDevice: !!current,
    deviceID: Types.stringToDeviceID('123'),
    lastUsed: lastUsed ? new Date('2002-10-10T01:23:45').getTime() : 0,
    name: `My ${type}`,
    revokedAt: revoked ? new Date('2002-10-11T01:23:45').getTime() : null,
    type,
  })
}

const common = Sb.createStoreWithCommon()

const store = {
  ...common,
  devices: common.devices.mergeDeep(
    I.Map({
      deviceMap: {
        backup: makeDevice({type: 'backup'}),
        'backup revoked': makeDevice({revoked: true, type: 'backup'}),
        desktop: makeDevice({type: 'desktop'}),
        'desktop current': makeDevice({current: true, type: 'desktop'}),
        'desktop no last': makeDevice({lastUsed: false, type: 'desktop'}),
        'desktop revoked': makeDevice({revoked: true, type: 'desktop'}),
        mobile: makeDevice({type: 'mobile'}),
        'mobile revoked': makeDevice({revoked: true, type: 'mobile'}),
      },
    })
  ),
}

const storeNOPW = {
  ...common,
  devices: common.devices.mergeDeep(
    I.Map({
      deviceMap: {
        'desktop last nopw': makeDevice({type: 'desktop'}),
      },
    })
  ),
  settings: common.settings.mergeDeep(
    I.Map({
      password: {
        randomPW: true,
      },
    })
  ),
}

const load = () => {
  Sb.storiesOf('Devices/Device', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Desktop', () => <DevicePage {...Sb.createNavigator({deviceID: 'desktop'})} />)
    .add('Desktop no last used', () => <DevicePage {...Sb.createNavigator({deviceID: 'desktop no last'})} />)
    .add('Desktop current', () => <DevicePage {...Sb.createNavigator({deviceID: 'desktop current'})} />)
    .add('Desktop Revoked', () => <DevicePage {...Sb.createNavigator({deviceID: 'desktop revoked'})} />)
    .add('Mobile', () => <DevicePage {...Sb.createNavigator({deviceID: 'mobile'})} />)
    .add('Mobile Revoked', () => <DevicePage {...Sb.createNavigator({deviceID: 'mobile revoked'})} />)
    .add('Paper key', () => <DevicePage {...Sb.createNavigator({deviceID: 'backup'})} />)
    .add('Paper key Revoked', () => <DevicePage {...Sb.createNavigator({deviceID: 'backup revoked'})} />)
  Sb.storiesOf('Devices/Device/NOPW', module)
    .addDecorator((story: any) => <Sb.MockStore store={storeNOPW}>{story()}</Sb.MockStore>)
    .add('Desktop only device', () => <DevicePage {...Sb.createNavigator({deviceID: 'desktop last nopw'})} />)
}

export default load
