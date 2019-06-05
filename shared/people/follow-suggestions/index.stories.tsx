import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/people'
import FollowSuggestions from '.'

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  Sb.PropProviders.Avatar(['max', 'cnojima', 'cdixon'], [])
)

const props1 = {
  suggestions: [
    {
      followsMe: true,
      fullName: 'Danny Ayoub',
      iFollow: false,
      username: 'ayoubd',
    },
  ].map(Constants.makeFollowSuggestion),
}

const props2 = {
  suggestions: [
    {
      followsMe: true,
      fullName: 'Danny Ayoub',
      iFollow: false,
      username: 'ayoubd',
    },
    {
      followsMe: true,
      fullName: 'Max Krohn',
      iFollow: false,
      username: 'max',
    },
    {
      followsMe: false,
      fullName: 'Chris Nojima',
      iFollow: false,
      username: 'chrisnojima',
    },
    {
      followsMe: true,
      fullName: "Jack O'Connor",
      iFollow: false,
      username: 'oconnor663',
    },
    {
      followsMe: true,
      fullName: 'Miles Steele',
      iFollow: false,
      username: 'mlsteele',
    },
    {
      followsMe: true,
      fullName: 'Steve Sanders',
      iFollow: false,
      username: 'zanderz',
    },
    {
      followsMe: true,
      fullName: 'Chris Coyne',
      iFollow: false,
      username: 'chris',
    },
  ].map(Constants.makeFollowSuggestion),
}

const props3 = {
  suggestions: props2.suggestions.concat(
    props2.suggestions.map(suggestion => suggestion.set('username', suggestion.username + '1'))
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
