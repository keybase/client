import * as Constants from '../../constants/devices'
import * as Container from '../../util/container'
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/devices'
import DeviceRevoke, {Props} from '.'

const props: Props = {
  device: Constants.makeDevice({
    currentDevice: false,
    deviceID: Types.stringToDeviceID('id'),
    name: 'my computer',
    type: 'desktop',
  }),
  endangeredTLFs: [],
  iconNumber: 1,
  onCancel: Sb.action('oncancel'),
  onSubmit: Sb.action('onsubmit'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Devices/Revoke', module)
    .add('Paper key', () => (
      <DeviceRevoke
        {...props}
        device={Container.produce(props.device, draftState => {
          draftState.name = 'my paper key'
          draftState.type = 'backup'
        })}
      />
    ))
    .add('Mobile Device', () => (
      <DeviceRevoke
        {...props}
        device={Container.produce(props.device, draftState => {
          draftState.name = 'my iphone'
          draftState.type = 'mobile'
        })}
      />
    ))
    .add('Desktop Device', () => <DeviceRevoke {...props} />)
    .add('Current Device', () => (
      <DeviceRevoke
        {...props}
        device={Container.produce(props.device, draftState => {
          draftState.currentDevice = true
        })}
      />
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
