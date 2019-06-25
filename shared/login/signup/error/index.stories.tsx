import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Error from '.'

const load = () => {
  Sb.storiesOf('Signup', module).add('Error', () => (
    <Error
      header="This is an error header, it is really really long"
      body="This is an error body, it is really really long."
      onBack={Sb.action('onBack')}
    />
  ))
}

export default load
