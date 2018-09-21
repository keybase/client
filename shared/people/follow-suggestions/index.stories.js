// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import FollowSuggestions, {type Props} from '.'

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  Sb.PropProviders.Avatar(['max', 'cnojima', 'cdixon'], [])
)

const props1: Props = {
  suggestions: [
    {
      username: 'ayoubd',
      fullName: 'Danny Ayoub',
      followsMe: true,
      iFollow: false,
    },
  ],
}

const props2: Props = {
  suggestions: [
    {
      username: 'ayoubd',
      fullName: 'Danny Ayoub',
      followsMe: true,
      iFollow: false,
    },
    {
      username: 'max',
      fullName: 'Max Krohn',
      followsMe: true,
      iFollow: false,
    },
    {
      username: 'chrisnojima',
      fullName: 'Chris Nojima',
      followsMe: false,
      iFollow: false,
    },
    {
      username: 'oconnor663',
      fullName: "Jack O'Connor",
      followsMe: true,
      iFollow: false,
    },
    {
      username: 'mlsteele',
      fullName: 'Miles Steele',
      followsMe: true,
      iFollow: false,
    },
    {
      username: 'zanderz',
      fullName: 'Steve Sanders',
      followsMe: true,
      iFollow: false,
    },
    {
      username: 'chris',
      fullName: 'Chris Coyne',
      followsMe: true,
      iFollow: false,
    },
  ],
}

const props3: Props = {
  suggestions: props2.suggestions.concat(
    props2.suggestions.map(suggestion => ({...suggestion, username: suggestion.username + '1'}))
  ),
}

const load = () => {
  Sb.storiesOf('People/Follow Suggestions', module)
    .addDecorator(provider)
    .add('One', () => <FollowSuggestions {...props1} />)
    .add('Several', () => <FollowSuggestions {...props2} />)
    .add('Overflow', () => <FollowSuggestions {...props3} />)
}

export default load
