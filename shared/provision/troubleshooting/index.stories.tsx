import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Troubleshooting from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/provision'

const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  const deviceMap = new Map(draftState.devices.deviceMap)
  deviceMap.set('Work Laptop', {
    created: 1,
    currentDevice: false,
    deviceID: '123',
    lastUsed: 1,
    name: 'Work Laptop',
    type: 'desktop',
  })
  draftState.devices.deviceMap = deviceMap
  draftState.provision = Constants.makeState({
    codePageOtherDeviceId: '123',
    codePageOtherDeviceName: 'Work Laptop',
  })
})

const load = () => {
  Sb.storiesOf('Provision', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Troubleshooting', () => (
      <Troubleshooting mode="QR" onCancel={Sb.action('cancel')} otherDeviceType="desktop" />
    ))
}

export default load
