import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Error from '.'

const load = () => {
  Sb.storiesOf('Signup', module).add('Error', () => (
    <Error error="This is an error" onBack={Sb.action('onBack')} />
  ))
}

export default load
