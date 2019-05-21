import * as React from 'react'
import * as Sb from '../../stories/storybook'
import PaperKey from '.'

const props = {
  onBack: Sb.action('onBack'),
  paperkey: 'one two three four five six seven eight nine',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Devices/Paperkey', module)
    .add('Normal', () => <PaperKey {...props} />)
    .add('Waiting', () => <PaperKey {...props} waiting={true} paperkey={''} />)
}

export default load
