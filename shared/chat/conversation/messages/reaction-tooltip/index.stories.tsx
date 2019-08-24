import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Sb from '../../../../stories/storybook'
import {propProvider as ReactButton} from '../react-button/index.stories'
import {upperFirst} from 'lodash-es'
import ReactionTooltip, {Props} from '.'
import {OwnProps} from './container'

const provider = Sb.createPropProviderWithCommon(ReactButton)

const common = {
  attachmentRef: () => null,
  conversationIDKey: Constants.noConversationIDKey,
  onAddReaction: Sb.action('onAddReaction'),
  onHidden: Sb.action('onHidden'),
  ordinal: Types.numberToOrdinal(0),
  visible: true,
}

const examples = [
  {
    ...common,
    reactions: [
      {
        emoji: ':+1:',
        users: [
          {fullName: 'Danny Ayoub', username: 'ayoubd'},
          {fullName: 'Chris Nojima', username: 'chrisnojima'},
          {fullName: 'Cecile Boucheron', username: 'cecileb'},
          {fullName: 'Chris Coyne', username: 'chris'},
          {fullName: 'Chris Ball', username: 'cjb'},
          {fullName: 'Miles Steele', username: 'mlsteele'},
          {fullName: 'Max Krohn', username: 'max'},
          {fullName: 'Mike Maxim', username: 'mikem'},
          {fullName: 'Fred Akalin', username: 'akalin'},
        ],
      },
    ],
  },
  {
    ...common,
    reactions: [
      {
        emoji: ':face_with_cowboy_hat:',
        users: [{fullName: 'Danny Ayoub', username: 'ayoubd'}],
      },
    ],
  },
  {
    ...common,
    reactions: [
      {
        emoji: ':face_with_cowboy_hat:',
        users: [{fullName: 'Danny Ayoub', username: 'ayoubd'}],
      },
      {
        emoji: ':spider:',
        users: [
          {fullName: 'Chris Coyne', username: 'chris'},
          {fullName: 'Jacob Young', username: 'jacobyoung'},
        ],
      },
      {
        emoji: ':bee:',
        users: [
          {fullName: 'Miles Steele', username: 'mlsteele'},
          {fullName: 'Chris Nojima', username: 'chrisnojima'},
        ],
      },
      {
        emoji: ':honey_pot:',
        users: [
          {fullName: 'Mike Maxim', username: 'mikem'},
          {fullName: 'Danny Ayoub', username: 'ayoubd'},
          {fullName: 'Patrick Crosby', username: 'patrick'},
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
const rng = new Sb.Rnd(7324)
const makeName = () => {
  const length = (rng.next() % 5) + 3
  let res = ''
  for (let i = 0; i < length; i++) {
    if (i % 2 === 0) {
      res += consonants[rng.next() % consonants.length]
    } else {
      res += vowels[rng.next() % vowels.length]
    }
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
  const users: Array<ReturnType<typeof makeUser>> = []
  for (let i = 0; i < num; i++) {
    users.push(makeUser())
  }
  return users
}
examples.push({
  ...common,
  reactions: emoji.map(e => ({
    emoji: e,
    users: makeUsers((rng.next() % maxUsersInReaction) + 1),
  })),
})

const load = () => {
  const story = Sb.storiesOf('Chat/Conversation/Reaction tooltip', module).addDecorator(provider)
  examples.forEach((ex, i) => story.add(`Example ${i + 1}`, () => <ReactionTooltip {...ex} />))
}

export const propProvider = {
  ReactionTooltip: (ownProps: OwnProps): Props => ({
    attachmentRef: ownProps.attachmentRef,
    conversationIDKey: ownProps.conversationIDKey,
    onAddReaction: Sb.action('onAddReaction'),
    onHidden: ownProps.onHidden,
    onMouseLeave: ownProps.onMouseLeave,
    onMouseOver: ownProps.onMouseOver,
    ordinal: ownProps.ordinal,

    // we can mock this out better later if wanted
    reactions: examples[0].reactions,

    visible: ownProps.visible,
  }),
}

export default load
