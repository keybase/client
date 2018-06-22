// @flow
import * as React from 'react'
import UsernameEmailForm from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {Box2} from '../../../common-adapters'
import * as PropProviders from '../../../stories/prop-providers'

const props = {
  emailErrorText: '',
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  submitUserEmail: action('submitUserEmail'),
  usernameErrorText: '',
  waiting: false,
}

const load = () => {
  storiesOf('Signup/Username email', module)
    .addDecorator(PropProviders.Common())
    .addDecorator(story => (
      <Box2 direction="vertical" style={{height: '100%', width: '100%'}}>
        {story()}
      </Box2>
    ))
    .add('Start', () => <UsernameEmailForm {...props} />)
    .add('Name Error', () => <UsernameEmailForm {...props} usernameErrorText={'Name bad, smash!'} />)
    .add('Email Error', () => <UsernameEmailForm {...props} emailErrorText={'Email bad, booo'} />)
}

export default load
