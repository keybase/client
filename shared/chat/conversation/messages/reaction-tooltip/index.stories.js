// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {action, createPropProvider, storiesOf} from '../../../../stories/storybook'
import {Common} from '../../../../stories/prop-providers'
import {propProvider as ReactButton} from '../react-button/index.stories'
import ReactionTooltip from '.'

const provider = createPropProvider(Common(), ReactButton)

const actions = {
  onAddReaction: action('onAddReaction'),
  onHidden: action('onHidden'),
  onReact: action('onReact'),
}

const examples = [
  {
    ...actions,
    messageID: Types.numberToMessageID(0),
    reactions: [
      {
        emoji: ':+1:',
        users: [
          {username: 'ayoubd', fullName: 'Danny Ayoub'},
          {username: 'chrisnojima', fullName: 'Chris Nojima'},
          {username: 'cecileb', fullName: 'Cecile Boucheron'},
          {username: 'chris', fullName: 'Chris Coyne'},
          {username: 'cjb', fullName: 'Chris Ball'},
          {username: 'mlsteele', fullName: 'Miles Steele'},
          {username: 'max', fullName: 'Max Krohn'},
          {username: 'mikem', fullName: 'Mike Maxim'},
          {username: 'akalin', fullName: 'Fred Akalin'},
        ],
      },
    ],
  },
  {
    ...actions,
    messageID: Types.numberToMessageID(0),
    reactions: [
      {
        emoji: ':face_with_cowboy_hat:',
        users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}],
      },
    ],
  },
  {
    ...actions,
    messageID: Types.numberToMessageID(0),
    reactions: [
      {
        emoji: ':face_with_cowboy_hat:',
        users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}],
      },
      {
        emoji: ':spider:',
        users: [
          {username: 'chris', fullName: 'Chris Coyne'},
          {username: 'jacobyoung', fullName: 'Jacob Young'},
        ],
      },
      {
        emoji: ':bee:',
        users: [
          {username: 'mlsteele', fullName: 'Miles Steele'},
          {username: 'chrisnojima', fullName: 'Chris Nojima'},
        ],
      },
      {
        emoji: ':honey_pot:',
        users: [
          {username: 'mikem', fullName: 'Mike Maxim'},
          {username: 'ayoubd', fullName: 'Danny Ayoub'},
          {username: 'patrick', fullName: 'Patrick Crosby'},
        ],
      },
    ],
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/Reaction tooltip', module).addDecorator(provider)
  examples.forEach((ex, i) => story.add(`Example ${i + 1}`, () => <ReactionTooltip {...ex} />))
}

export default load
