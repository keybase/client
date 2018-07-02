// @flow
import * as React from 'react'
import Error from '.'
import {action, storiesOf} from '../../../stories/storybook'
import * as PropProviders from '../../../stories/prop-providers'

const load = () => {
  storiesOf('Signup', module)
    .addDecorator(PropProviders.Common())
    .add('Error', () => (
      <Error error="This is an error" onBack={action('onBack')} onRestart={action('onRestart')} />
    ))
}

export default load
