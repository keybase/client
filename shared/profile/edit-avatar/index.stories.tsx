import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EditAvatar from '.'

const provider = Sb.createPropProviderWithCommon()

const props = {
  error: '',
  onClose: Sb.action('onClose'),
  onSave: Sb.action('onSave'),
  submitting: false,
  waitingKey: 'dummyWaitingKey',
}

const load = () => {
  Sb.storiesOf('Profile/EditAvatar', module)
    .addDecorator(provider)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Error', () => <EditAvatar {...props} error="Bad avatar. Try another one." />)
}

export default load
