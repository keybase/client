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
  storiesOf('People/Follow notification', module)
    .addDecorator(story => (
      <Provider store={createStore(ignore => store, store)}>
        {story()}
      </Provider>
    ))
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
}

export default load
