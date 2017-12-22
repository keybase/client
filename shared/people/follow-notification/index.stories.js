// @flow
import React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {Set} from 'immutable'
import {storiesOf} from '../../stories/storybook'
import FollowNotification, {type Props} from '.'

const store = {
  config: {
    following: Set(['max', 'cnojima', 'cdixon']),
    you: 'ayoubd',
  },
}

const singleFollowProps1: Props = {
  newFollows: [{username: 'mmaxim'}],
  badged: true,
}

const singleFollowProps2: Props = {
  newFollows: [{username: 'max'}],
  badged: false,
}

const load = () => {
  storiesOf('People', module)
    .add('Someone followed you', () => (
      <Provider store={createStore(ignore => store, store)}>
        <FollowNotification {...singleFollowProps1} />
      </Provider>
    ))
    .add('Someone you follow followed you', () => (
      <Provider store={createStore(ignore => store, store)}>
        <FollowNotification {...singleFollowProps2} />
      </Provider>
    ))
}

export default load
