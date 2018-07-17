// @flow
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {action, createPropProvider, storiesOf, Rnd} from '../../../../stories/storybook'
import {Common} from '../../../../stories/prop-providers'
import {propProvider as ReactButton} from '../react-button/index.stories'
import {upperFirst} from 'lodash-es'
import ReactionTooltip from '.'

const provider = createPropProvider(Common(), ReactButton)

const common = {
  conversationIDKey: Constants.noConversationIDKey,
  onAddReaction: action('onAddReaction'),
  onHidden: action('onHidden'),
  onReact: action('onReact'),
  ordinal: Types.numberToOrdinal(0),
}

const examples = [
  {
    ...common,
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
    ...common,
    reactions: [
      {
        emoji: ':face_with_cowboy_hat:',
        users: [{username: 'ayoubd', fullName: 'Danny Ayoub'}],
      },
    ],
  },
  {
    ...common,
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

// Make random test case - useful for
// testing performance of desktop sectionlist
const maxUsersInReaction = 15

const consonants = 'BCDFGHJKLMNPQRSTVWXYZ'.split('')
const vowels = 'AEIOU'.split('')
const emoji = [':+1:', ':-1:', ':heavy_check_mark:', ':boom:', ':globe_with_meridians:', ':bathtub:']
const rng = new Rnd(7324)
const makeName = () => {
  const length = rng.next() % 5 + 3
  let res = ''
  for (let i = 0; i < length; i++) {
    i % 2 === 0
      ? (res += consonants[rng.next() % consonants.length])
      : (res += vowels[rng.next() % vowels.length])
  }
  return upperFirst(res.toLowerCase())
}
const makeUser = () => {
  const fn = makeName()
  const ln = makeName()
  return {
    fullName: `${fn} ${ln}`,
    username: (fn + ln).toLowerCase(),
  }
}
const makeUsers = (num: number) => {
  const users = []
  for (let i = 0; i < num; i++) {
    users.push(makeUser())
  }
  return users
}
examples.push({
  ...common,
  reactions: emoji.map(e => ({
    emoji: e,
    users: makeUsers(rng.next() % maxUsersInReaction + 1),
  })),
})

const load = () => {
  const story = storiesOf('Chat/Conversation/Reaction tooltip', module).addDecorator(provider)
  examples.forEach((ex, i) => story.add(`Example ${i + 1}`, () => <ReactionTooltip {...ex} />))
}

export default load
