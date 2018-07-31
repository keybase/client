// @flow
import * as React from 'react'
import Error from '.'
import {action, storiesOf, PropProviders} from '../../../stories/storybook'

const load = () => {
  storiesOf('Signup', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Error', () => (
      <Error error="This is an error" onBack={action('onBack')} onRestart={action('onRestart')} />
    ))
}

export default load
