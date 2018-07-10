// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import ReactButton from '.'

const examples = [
  {
    count: 1,
    emoji: ':+1:',
    onClick: action('onClick'),
  },
  {
    count: 4,
    emoji: ':face_with_cowboy_hat:',
    onClick: action('onClick'),
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/React Button', module).addDecorator(story => (
    <Box style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: 24}}>
      {story()}
    </Box>
  ))
  examples.forEach(ex => story.add(ex.emoji, () => <ReactButton {...ex} />))
}

export default load
