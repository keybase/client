import * as React from 'react'
import GPGSign from './index'
import {storiesOf, action} from '../../stories/storybook'

const load = () => {
  storiesOf('Provision/GPGSign', module)
    .add('GPGSign', () => (
      <GPGSign importError={null} onSubmit={action('onSubmit')} onBack={action('onBack')} />
    ))
    .add('GPGSign with import error', () => (
      <GPGSign importError={'Too many failures'} onSubmit={action('onSubmit')} onBack={action('onBack')} />
    ))
}

export default load
