// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {default as DeviceRevoke, type Props} from '.'

const devicesProps: Props = {
  currentDevice: false,
  deviceID: 'id',
  type: 'desktop',
  endangeredTLFs: [],
  name: 'my computer',
  onCancel: action('oncancel'),
  onSubmit: action('onsubmit'),
  waiting: false,
}

const load = () => {
  storiesOf('Devices/Revoke', module)
    .add('Paper key', () => <DeviceRevoke {...devicesProps} type="backup" name="my paper key" />)
    .add('Mobile Device', () => <DeviceRevoke {...devicesProps} type="mobile" name="my iphone" />)
    .add('Desktop Device', () => <DeviceRevoke {...devicesProps} />)
    .add('Current Device', () => <DeviceRevoke {...devicesProps} currentDevice={true} />)
    .add('Device Loading', () => <DeviceRevoke {...devicesProps} waiting={true} />)
    .add('Device with Endangered TLFs', () => (
      <DeviceRevoke
        {...devicesProps}
        endangeredTLFs={[
          'nathunsmitty',
          'nathunsmitty,chrisnojima',
          'nathunsmitty,chrisnojima,jacobyoung,verylongtlfname',
          'nathunsmitty,ayoubd',
          'nathunsmitty,jzila',
          'nathunsmitty,xgess',
          'nathunsmitty,chris',
        ]}
      />
    ))
}

export default load
