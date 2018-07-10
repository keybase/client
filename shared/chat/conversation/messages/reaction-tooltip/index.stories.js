// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../stories/storybook'
import {CommonProvider} from '../../../../stories/prop-providers'
import ReactionTooltip from '.'

const examples = [
  {
    emoji: ':+1:',
    onHidden: action('onHidden'),
    onReact: action('onReact'),
    users: [
      {username: 'ayoubd', fullName: 'Danny Ayoub'},
      {username: 'cnojima', fullName: 'Chris Nojima'},
      {username: 'cecileb', fullName: 'Cecile Boucheron'},
      {username: 'chris', fullName: 'Chris Coyne'},
      {username: 'cjb', fullName: 'Chris Ball'},
      {username: 'mlsteele', fullName: 'Miles Steele'},
      {username: 'max', fullName: 'Max Krohn'},
      {username: 'mikem', fullName: 'Mike Maxim'},
      {username: 'akalin', fullName: 'Fred Akalin'},
    ],
  },
  {
    emoji: ':face_with_cowboy_hat:',
    onHidden: action('onHidden'),
    onReact: action('onReact'),
    users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}],
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/Reaction tooltip', module).addDecorator(CommonProvider())
  examples.forEach(ex => story.add(ex.emoji, () => <ReactionTooltip {...ex} />))
}

export default load
