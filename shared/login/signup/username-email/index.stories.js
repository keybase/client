// @flow
import * as React from 'react'
import * as PropProviders from '../../../stories/prop-providers'
import UsernameEmail from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {Box2} from '../../../common-adapters'

const props = {
  email: '',
  emailError: '',
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  username: '',
  usernameError: '',
}

const load = () => {
  storiesOf('Signup/Username email', module)
    .addDecorator(PropProviders.Common())
    .addDecorator(story => (
      <Box2 direction="vertical" style={{height: '100%', width: '100%'}}>
        {story()}
      </Box2>
    ))
    .add('Start', () => <UsernameEmail {...props} />)
    .add('Name Error', () => <UsernameEmail {...props} usernameError={'Name bad, smash!'} />)
    .add('Email Error', () => <UsernameEmail {...props} emailError={'Email bad, booo'} />)
}

export default load
