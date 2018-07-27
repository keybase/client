// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import PaperKey from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  error: '',
  hint: 'chill dog...',
  onBack: action('onBack'),
  onChangePaperKey: action('onChangePaperKey'),
  onSubmit: action('onSubmit'),
  paperKey: '',
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Provision/Paperkey', module)
    .addDecorator(PropProviders.CommonProvider())
    .add('Normal', () => <PaperKey {...props} />)
    .add('Error', () => <PaperKey {...props} error="Something went wrong" />)
}

export default load
