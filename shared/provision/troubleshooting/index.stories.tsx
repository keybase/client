import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Troubleshooting from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/provision'

const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.provision = {
    ...Constants.makeState(),
    codePageOtherDevice: {
      deviceNumberOfType: 3,
      id: '1',
      name: 'My laptop',
      type: 'desktop',
    },
  }
})

const load = () => {
  Sb.storiesOf('Provision', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Troubleshooting', () => (
      <Troubleshooting mode="QR" onCancel={Sb.action('cancel')} otherDeviceType="desktop" />
    ))
}

export default load
