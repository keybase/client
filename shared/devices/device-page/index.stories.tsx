import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Sb from '../../stories/storybook'
import DevicePageReal from './container'

type Props = {
  _revoked?: boolean
  _type?: 'mobile' | 'desktop' | 'backup'
  _current?: boolean
  _lastUsed?: boolean
  _revokedAt?: Date | null
}

const DevicePage = (props: Props) => {
  const p: any = props
  return <DevicePageReal {...p} />
}

const common = Sb.createStoreWithCommon()

const store = {
  ...common,
  devices: common.devices.mergeIn(['deviceMap'], {
    mobile: Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My mobile`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'mobile',
    }),
    backup: Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My backup`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'backup',
    }),
    desktop: Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My desktop`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'desktop',
    }),
    'desktop no last used': Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: 0,
      name: `My desktop`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'desktop',
    }),
    'desktop current': Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: true,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My desktop`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'desktop',
    }),
    'backup revoked': Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My backup`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'backup',
    }),
    'desktop revoked': Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My desktop`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'desktop',
    }),
    'mobile revoked': Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: false,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: new Date('2002-10-10T01:23:45').getTime(),
      name: `My mobile`,
      revokedAt: new Date('2002-10-11T01:23:45').getTime(),
      type: 'mobile',
    }),
    // '123': Constants.makeDevice({
    // created: new Date('2002-10-09T01:23:45').getTime(),
    // currentDevice: !!_current,
    // deviceID: Types.stringToDeviceID('123'),
    // lastUsed: _lastUsed ? new Date('2002-10-10T01:23:45').getTime() : 0,
    // name: `My ${_type}`,
    // revokedAt: _revokedAt && _revoked ? new Date('2002-10-11T01:23:45').getTime() : null,
    // type: _type,
    // }),
  }),
}
/*{
  DevicePage: ({_revoked, _type, _current, _lastUsed = true, _revokedAt = true}) => ({
    onBack: Sb.action('onback'),
    showRevokeDevicePage: _revoked ? null : Sb.action('showRevokeDevicePage'),
  }),
})
     */

const load = () => {
  Sb.storiesOf('Devices/Device', module)
    .add('Desktop', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'desktop'})} />
      </Sb.MockStore>
    ))
    .add('Desktop no last used', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'desktop no last used'})} />
      </Sb.MockStore>
    ))
    .add('Desktop current', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'desktop current'})} />
      </Sb.MockStore>
    ))
    .add('Desktop Revoked', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'desktop revoked'})} />
      </Sb.MockStore>
    ))
    .add('Mobile', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'mobile'})} />
      </Sb.MockStore>
    ))
    .add('Mobile Revoked', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'mobile revoked'})} />
      </Sb.MockStore>
    ))
    .add('Paper key', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'backup'})} />
      </Sb.MockStore>
    ))
    .add('Paper key Revoked', () => (
      <Sb.MockStore store={store}>
        <DevicePage {...Sb.createNavigator({deviceID: 'backup revoked'})} />
      </Sb.MockStore>
    ))
}

export default load
