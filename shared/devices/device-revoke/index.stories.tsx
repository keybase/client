import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Types from '../../constants/types/devices'
import * as Sb from '../../stories/storybook'
import DeviceRevoke, {Props} from '.'

const props: Props = {
  device: Constants.makeDevice({
    currentDevice: false,
    deviceID: Types.stringToDeviceID('id'),
    name: 'my computer',
    type: 'desktop',
  }),
  endangeredTLFs: [],
  onCancel: Sb.action('oncancel'),
  onSubmit: Sb.action('onsubmit'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Devices/Revoke', module)
    .add('Paper key', () => (
      <DeviceRevoke {...props} device={props.device.merge({name: 'my paper key', type: 'backup'})} />
    ))
    .add('Mobile Device', () => (
      <DeviceRevoke {...props} device={props.device.merge({name: 'my iphone', type: 'mobile'})} />
    ))
    .add('Desktop Device', () => <DeviceRevoke {...props} />)
    .add('Current Device', () => (
      <DeviceRevoke {...props} device={props.device.merge({currentDevice: true})} />
    ))
    .add('Device with Endangered TLFs', () => (
      <DeviceRevoke
        {...props}
        endangeredTLFs={[
          'nathunsmitty',
          'nathunsmitty,chrisnojima',
          'nathunsmitty,chrisnojima,jacobyoung,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnam,verylongtlfnameeeeeeeeeee,verylongtlfname',
          'nathunsmitty,ayoubd',
          'nathunsmitty,jzila',
          'nathunsmitty,xgess',
          'nathunsmitty,chris',
        ]}
      />
    ))
  Sb.storiesOf('Devices/Revoke', module)
    .addDecorator(
      Sb.createPropProviderWithCommon({
        WaitingButton: p => ({...p, storeWaiting: true}),
      })
    )
    .add('Device Loading', () => <DeviceRevoke {...props} waiting={true} />)
}

export default load
