// @flow
import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Sb from '../../stories/storybook'
import DevicePageReal from './container'

type Props = {
  _revoked?: boolean,
  _type?: 'mobile' | 'desktop' | 'backup',
  _current?: boolean,
  _lastUsed?: boolean,
  _revokedAt?: ?Date,
}

const DevicePage = (props: Props) => {
  // $ForceType
  const p: void = props
  return <DevicePageReal {...p} />
}

const provider = Sb.createPropProviderWithCommon({
  DevicePage: ({_revoked, _type, _current, _lastUsed = true, _revokedAt = true}) => ({
    device: Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45').getTime(),
      currentDevice: !!_current,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: _lastUsed ? new Date('2002-10-10T01:23:45').getTime() : 0,
      name: `My ${_type}`,
      revokedAt: _revokedAt && _revoked ? new Date('2002-10-11T01:23:45').getTime() : null,
      type: _type,
    }),
    onBack: Sb.action('onback'),
    showRevokeDevicePage: _revoked ? null : Sb.action('showRevokeDevicePage'),
  }),
})

const load = () => {
  Sb.storiesOf('Devices/Device', module)
    .addDecorator(provider)
    .add('Desktop', () => <DevicePage _type="desktop" />)
    .add('Desktop no last used', () => <DevicePage _type="desktop" _lastUsed={false} />)
    .add('Desktop current', () => <DevicePage _type="desktop" _current={true} />)
    .add('Desktop Revoked', () => <DevicePage _type="desktop" _revoked={true} />)
    .add('Mobile', () => <DevicePage _type="mobile" />)
    .add('Mobile Revoked', () => <DevicePage _type="mobile" _revoked={true} />)
    .add('Paper key', () => <DevicePage _type="backup" />)
    .add('Paper key Revoked', () => <DevicePage _type="backup" _revoked={true} />)
}

export default load
