// @flow
import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Sb from '../../stories/storybook'
import DevicePage from './container'

const provider = Sb.createPropProviderWithCommon({
  DevicePage: ({revoked, type, current, lastUsed = true, revokedAt = true}) => ({
    device: Constants.makeDevice({
      created: new Date('2002-10-09T01:23:45'),
      currentDevice: !!current,
      deviceID: Types.stringToDeviceID('123'),
      lastUsed: lastUsed ? new Date('2002-10-10T01:23:45') : 0,
      name: `My ${type}`,
      revokedAt: revokedAt && revoked ? new Date('2002-10-11T01:23:45') : null,
      type,
    }),
    onBack: Sb.action('onback'),
    showRevokeDevicePage: revoked ? null : Sb.action('showRevokeDevicePage'),
  }),
})

const load = () => {
  Sb.storiesOf('Devices/Device', module)
    .addDecorator(provider)
    .add('Desktop', () => <DevicePage type="desktop" />)
    .add('Desktop no last used', () => <DevicePage type="desktop" lastUsed={false} />)
    .add('Desktop current', () => <DevicePage type="desktop" current={true} />)
    .add('Desktop Revoked', () => <DevicePage type="desktop" revoked={true} />)
    .add('Mobile', () => <DevicePage type="mobile" />)
    .add('Mobile Revoked', () => <DevicePage type="mobile" revoked={true} />)
    .add('Paper key', () => <DevicePage type="backup" />)
    .add('Paper key Revoked', () => <DevicePage type="backup" revoked={true} />)
}

export default load
