import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Container from '../../util/container'
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
    revokedAt: revoked ? new Date('2002-10-11T01:23:45').getTime() : undefined,
    type,
  })
}

const common = Sb.createStoreWithCommon()

const store = Container.produce(common, draftState => {
  const deviceMap = new Map(draftState.devices.deviceMap)
  deviceMap.set('backup', makeDevice({type: 'backup'}))
  deviceMap.set('backup revoked', makeDevice({revoked: true, type: 'backup'}))
  deviceMap.set('desktop', makeDevice({type: 'desktop'}))
  deviceMap.set('desktop current', makeDevice({current: true, type: 'desktop'}))
  deviceMap.set('desktop no last', makeDevice({lastUsed: false, type: 'desktop'}))
  deviceMap.set('desktop revoked', makeDevice({revoked: true, type: 'desktop'}))
  deviceMap.set('mobile', makeDevice({type: 'mobile'}))
  deviceMap.set('mobile revoked', makeDevice({revoked: true, type: 'mobile'}))
  draftState.devices.deviceMap = deviceMap
})

const storeNOPW = Container.produce(common, draftState => {
  const deviceMap = new Map(draftState.devices.deviceMap)
  deviceMap.set('desktop last nopw', makeDevice({type: 'desktop'}))
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
