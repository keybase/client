// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import UsernameEmail from '.'
import {Box2} from '../../../common-adapters'

const props = {
  email: '',
  emailError: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  username: '',
  usernameError: '',
}

const load = () => {
  Sb.storiesOf('Signup/Username email', module)
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
