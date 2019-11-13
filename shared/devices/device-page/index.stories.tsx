import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Container from '../../util/container'
import * as Sb from '../../stories/storybook'
import DevicePage from './container'

const makeDevice = (options: any) => {
  const {revoked, type, current, lastUsed = true} = options
  return Constants.makeDevice({
    created: options.created,
    currentDevice: !!current,
    deviceID: Types.stringToDeviceID(options.deviceID),
    lastUsed: lastUsed ? new Date('2002-10-10T01:23:45').getTime() : 0,
    name: `My ${type}`,
    revokedAt: revoked ? new Date('2002-10-11T01:23:45').getTime() : undefined,
    type,
  })
}

const common = Sb.createStoreWithCommon()

const store = Container.produce(common, draftState => {
  const deviceMap = new Map(draftState.devices.deviceMap)
  deviceMap.set('backup', makeDevice({created: 0, deviceID: 'backup', type: 'backup'}))
  deviceMap.set(
    'backup revoked',
    makeDevice({created: 1, deviceID: 'backup revoked', revoked: true, type: 'backup'})
  )
  deviceMap.set('desktop', makeDevice({created: 2, deviceID: 'desktop', type: 'desktop'}))
  deviceMap.set(
    'desktop current',
    makeDevice({created: 3, current: true, deviceID: 'desktop current', type: 'desktop'})
  )
  deviceMap.set(
    'desktop no last',
    makeDevice({created: 4, deviceID: 'desktop no last', lastUsed: false, type: 'desktop'})
  )
  deviceMap.set(
    'desktop revoked',
    makeDevice({created: 5, deviceID: 'desktop revoked', revoked: true, type: 'desktop'})
  )
  deviceMap.set('mobile', makeDevice({created: 6, deviceID: 'mobile', type: 'mobile'}))
  deviceMap.set(
    'mobile revoked',
    makeDevice({created: 7, deviceID: 'mobile revoked', revoked: true, type: 'mobile'})
  )
  draftState.devices.deviceMap = deviceMap
})

const storeNOPW = Container.produce(common, draftState => {
  const deviceMap = new Map(draftState.devices.deviceMap)
  deviceMap.set('desktop last nopw', makeDevice({deviceID: 'desktop last nopw', type: 'desktop'}))
  draftState.devices.deviceMap = deviceMap
  draftState.settings.password.randomPW = true
})

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
