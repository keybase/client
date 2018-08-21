// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/people'
import FollowSuggestions, {type Props} from '.'

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  Sb.PropProviders.Avatar(['max', 'cnojima', 'cdixon'], [])
)

const props1: Props = {
  onClickUser: Sb.action('onClickUser'),
  suggestions: [
    Constants.makeFollowSuggestion({
      username: 'ayoubd',
      fullName: 'Danny Ayoub',
      followsMe: true,
      iFollow: false,
    }),
  ],
}

const props2: Props = {
  onClickUser: Sb.action('onClickUser'),
  suggestions: [
    Constants.makeFollowSuggestion({
      username: 'ayoubd',
      fullName: 'Danny Ayoub',
      followsMe: true,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'max',
      fullName: 'Max Krohn',
      followsMe: true,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'chrisnojima',
      fullName: 'Chris Nojima',
      followsMe: false,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'oconnor663',
      fullName: "Jack O'Connor",
      followsMe: true,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'mlsteele',
      fullName: 'Miles Steele',
      followsMe: true,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'zanderz',
      fullName: 'Steve Sanders',
      followsMe: true,
      iFollow: false,
    }),
    Constants.makeFollowSuggestion({
      username: 'chris',
      fullName: 'Chris Coyne',
      followsMe: true,
      iFollow: false,
    }),
  ],
}

const props3: Props = {
  onClickUser: Sb.action('onClickUser'),
  suggestions: props2.suggestions.concat(
    props2.suggestions.map(suggestion =>
      Constants.makeFollowSuggestion({...suggestion.toObject(), username: suggestion.username + '1'})
    )
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
