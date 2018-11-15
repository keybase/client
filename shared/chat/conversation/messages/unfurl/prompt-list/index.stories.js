// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters/index'
import * as Sb from '../../../../../stories/storybook'
import UnfurlPromptList from '.'

const prompts = [
  {
    domain: 'cnn.com',
    onAlways: Sb.action('onAlways'),
    onAccept: Sb.action('onAccept'),
    onNotnow: Sb.action('onNotnow'),
    onNever: Sb.action('onNever'),
  },
  {
    domain: 'github.com',
    onAlways: Sb.action('onAlways'),
    onAccept: Sb.action('onAccept'),
    onNotnow: Sb.action('onNotnow'),
    onNever: Sb.action('onNever'),
  },
  {
    domain: 'wsj.com',
    onAlways: Sb.action('onAlways'),
    onAccept: Sb.action('onAccept'),
    onNotnow: Sb.action('onNotnow'),
    onNever: Sb.action('onNever'),
  },
]

const props = {
  prompts,
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Prompt-List', module)
    .addDecorator(story => <Box style={{maxWidth: 600}}>{story()}</Box>)
    .add('Default', () => <UnfurlPromptList {...props} />)
}

export default load
