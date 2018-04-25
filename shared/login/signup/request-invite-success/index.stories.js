// @flow
import * as React from 'react'
import RequestInviteSuccess from '.'
import {action, storiesOf} from '../../../stories/storybook'

const load = () => {
  storiesOf('Signup', module).add('Request Invite Success', () => (
    <RequestInviteSuccess onBack={action('onBack')} />
  ))
}

export default load
