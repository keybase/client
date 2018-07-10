// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../stories/storybook'
import ReactionTooltip from '.'

const examples = [
  {
    onHidden: action('onHidden'),
    onReact: action('onReact'),
    reaction: ':thumbs-up:',
    users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}, {username: 'cnojima', fullName: 'Chris Nojima'}],
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/Reaction tooltip', module)
  examples.forEach(ex => story.add(ex.reaction, () => <ReactionTooltip {...ex} />))
}

export default load
