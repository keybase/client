import * as React from 'react'
import * as Sb from '../../stories/storybook'
import PaperKey from '.'

const props = {
  error: '',
  hint: 'chill dog...',
  onBack: Sb.action('onBack'),
  onChangePaperKey: Sb.action('onChangePaperKey'),
  onSubmit: Sb.action('onSubmit'),
  paperKey: '',
  waitingForResponse: false,
}

const load = () => {
  Sb.storiesOf('Provision/Paperkey', module)
    .add('Normal', () => <PaperKey {...props} />)
    .add('Error', () => <PaperKey {...props} error="Something went wrong" />)
}

export default load
