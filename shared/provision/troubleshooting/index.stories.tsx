import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Troubleshooting from '.'
import * as Constants from '../../constants/provision'

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Provision', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
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
    )
    .add('Troubleshooting', () => (
      <Troubleshooting mode="QR" onCancel={Sb.action('cancel')} otherDeviceType="desktop" />
    ))
}

export default load
