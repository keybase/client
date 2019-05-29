import * as React from 'react'
import {Box} from '../../../../../../common-adapters/index'
import * as Sb from '../../../../../../stories/storybook'

import UnfurlPrompt from '.'

const props = {
  domain: 'cnn.com',
  onAccept: Sb.action('onAccept'),
  onAlways: Sb.action('onAlways'),
  onNever: Sb.action('onNever'),
  onNotnow: Sb.action('onNotnow'),
  onOnetime: Sb.action('onOnetime'),
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Prompt', module)
    .addDecorator(story => <Box style={{maxWidth: 600}}>{story()}</Box>)
    .add('Default', () => <UnfurlPrompt {...props} />)
}

export default load
