// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {action, createPropProvider, storiesOf} from '../../../../stories/storybook'
import {Common} from '../../../../stories/prop-providers'
import {propProvider as ReactButton} from '../react-button/index.stories'
import ReactionTooltip from '.'

const provider = createPropProvider(Common(), ReactButton)

const examples = [
  {
    emoji: ':+1:',
    messageID: Types.numberToMessageID(0),
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
    messageID: Types.numberToMessageID(0),
    onHidden: action('onHidden'),
    onReact: action('onReact'),
    users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}],
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/Reaction tooltip', module).addDecorator(provider)
  examples.forEach(ex => story.add(ex.emoji, () => <ReactionTooltip {...ex} />))
}

export default load
