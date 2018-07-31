// @flow
import * as React from 'react'
import PaperKey from '.'
import {action, storiesOf, PropProviders} from '../../stories/storybook'

const props = {
  onBack: action('onBack'),
  paperkey: 'one two three four five six seven eight nine',
  waiting: false,
}

const load = () => {
  storiesOf('Devices/Paperkey', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Normal', () => <PaperKey {...props} />)
    .add('Waiting', () => <PaperKey {...props} waiting={true} paperkey={''} />)
}

export default load
