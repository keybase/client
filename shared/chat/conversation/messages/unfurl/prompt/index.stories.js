import * as React from 'react'
import {storiesOf} from '../../../../../stories/storybook'
import {Box} from '../../../../../common-adapters/index'
import UnfurlPrompt from '.'

const props = {
  domain: 'cnn.com',
}

const load = () => {
  storiesOf('Chat/Unfurl/Prompt', module)
    .addDecorator(story => <Box style={{maxWidth: 420}}>{story()}</Box>)
    .add('Default', () => <UnfurlPrompt {...props} />)
}

export default load
