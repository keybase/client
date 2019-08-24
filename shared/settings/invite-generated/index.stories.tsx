import * as React from 'react'
import InvitesGenerated from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  email: 'user@gmail.com',
  link: 'keybase.io/inv/9999999999',
  onClose: action('onClose'),
}

const load = () => {
  storiesOf('Settings/InvitesGenerated', module)
    .add('Normal', () => <InvitesGenerated {...props} />)
    .add('No email', () => <InvitesGenerated {...props} email={''} />)
}

export default load
