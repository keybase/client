import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Error from '.'

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/Error', module).add('Error', () => (
    <Error error="This is an error body, it is really really long." onBack={Sb.action('onBack')} />
  ))
}

export default load
