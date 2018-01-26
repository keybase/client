// @flow
import * as React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'
import FollowSuggestions, {type Props} from '.'

const provider = PropProviders.compose(PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'))

const props1: Props = {
  onClickUser: action('onClickUser'),
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
  onClickUser: action('onClickUser'),
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
  onClickUser: action('onClickUser'),
  suggestions: props2.suggestions.concat(
    props2.suggestions.map(suggestion => ({...suggestion, username: suggestion.username + '1'}))
  ),
}

const load = () => {
  storiesOf('People/Follow Suggestions', module)
    .addDecorator(provider)
    .add('One', () => <FollowSuggestions {...props1} />)
    .add('Several', () => <FollowSuggestions {...props2} />)
    .add('Overflow', () => <FollowSuggestions {...props3} />)
}

export default load
