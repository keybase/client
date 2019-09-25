import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import PaperKey from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
}

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/PaperKey', module)
    .add('Normal', () => <PaperKey {...props} />)
    .add('Error', () => <PaperKey {...props} error="Something went wrong" />)
}

export default load
