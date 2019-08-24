import * as React from 'react'
import {Box} from '../../../../../../common-adapters/index'
import * as Sb from '../../../../../../stories/storybook'
import UnfurlPromptList from '.'

const common = {
  onAccept: Sb.action('onAccept'),
  onAlways: Sb.action('onAlways'),
  onNever: Sb.action('onNever'),
  onNotnow: Sb.action('onNotnow'),
  onOnetime: Sb.action('onOnetime'),
}

const props = {prompts: ['cnn.com', 'github.com', 'wsj.com'].map(domain => ({domain, ...common}))}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Prompt-List', module)
    .addDecorator(story => <Box style={{maxWidth: 600}}>{story()}</Box>)
    .add('Default', () => <UnfurlPromptList {...props} />)
}

export default load
