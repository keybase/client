// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import {type OwnProps} from './container'
import ReactButton, {type Props as ViewProps} from '.'

export const propProvider = {
  ReactButton: (props: OwnProps): ViewProps => ({
    active: props.emoji === ':face_with_cowboy_hat:',
    count: {':+1:': 2, ':face_with_cowboy_hat:': 1}[props.emoji] || 1,
    emoji: props.emoji,
    onClick: action('onReact'),
  }),
}

const examples = [
  {
    active: false,
    count: 1,
    emoji: ':+1:',
    onClick: action('onClick'),
  },
  {
    active: true,
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
  examples.forEach(ex => story.add(`${ex.emoji}${ex.active ? ' active' : ''}`, () => <ReactButton {...ex} />))
}

export default load
