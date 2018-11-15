// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters/index'
import * as Sb from '../../../../../stories/storybook'

import UnfurlPrompt from '.'

const props = {
  domain: 'cnn.com',
  onAlways: Sb.action('onAlways'),
  onAccept: Sb.action('onAccept'),
  onNotnow: Sb.action('onNotnow'),
  onNever: Sb.action('onNever'),
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Prompt', module)
    .addDecorator(story => <Box style={{maxWidth: 600}}>{story()}</Box>)
    .add('Default', () => <UnfurlPrompt {...props} />)
}

export default load
