import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import Block from '.'

const props = {
  errorMessage: null,
  idle: false,
  isWaiting: false,
  onClose: action('onClose'),
  onSubmit: action('onSubmit'),
  username: 'chris',
}

const load = () => {
  storiesOf('Profile/Block', module)
    .add('Block', () => <Block {...props} />)
    .add('Waiting', () => <Block {...props} isWaiting={true} />)
    .add('Error', () => (
      <Block
        {...props}
        errorMessage={'There was an error blocking chris.'}
      />
    ))
}

export default load
