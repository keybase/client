// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {Set, List} from 'immutable'
import {storiesOf, action} from '../../stories/storybook'
import FollowSuggestions, {type Props} from '.'

const store = {
  config: {
    following: Set(['max', 'cnojima', 'cdixon']),
    you: 'ayoubd',
  },
}

const props1: Props = {
  onClickUser: action('onClickUser'),
  suggestions: List([
    {
      username: 'ayoubd',
      fullName: 'Danny Ayoub',
      followsMe: true,
      iFollow: false,
    },
  ]),
}

const props2: Props = {
  onClickUser: action('onClickUser'),
  suggestions: List([
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
  ]),
}

const props3: Props = {
  onClickUser: action('onClickUser'),
  suggestions: props2.suggestions.concat(
    props2.suggestions.map(suggestion => ({...suggestion, username: suggestion.username + '1'}))
  ),
}

const load = () => {
  storiesOf('People/Follow Suggestions', module)
    .addDecorator(story => <Provider store={createStore(ignore => store, store)}>{story()}</Provider>)
    .add('One', () => <FollowSuggestions {...props1} />)
    .add('Several', () => <FollowSuggestions {...props2} />)
    .add('Overflow', () => <FollowSuggestions {...props3} />)
}

export default load
