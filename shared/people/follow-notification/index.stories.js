// @flow
import React from 'react'
import * as C from '../../constants/people'
import {action, storiesOf} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'
import FollowNotification, {type Props} from '.'
import moment from 'moment'

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'chrisnojima'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const singleFollowProps1: Props = {
  type: 'notification',
  newFollows: [C.makeFollowedNotification({username: 'mmaxim'})],
  badged: true,
  notificationTime: new Date(),
  onClickUser: action('onClickUser'),
}

const singleFollowProps2: Props = {
  type: 'notification',
  newFollows: [C.makeFollowedNotification({username: 'max'})],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'days')
    .toDate(),
  onClickUser: action('onClickUser'),
}

const multiFollowProps1: Props = {
  type: 'notification',
  newFollows: [
    C.makeFollowedNotification({username: 'max'}),
    C.makeFollowedNotification({username: 'mmaxim'}),
    C.makeFollowedNotification({username: 'chrisnojima'}),
  ],
  badged: true,
  notificationTime: moment()
    .subtract(3, 'weeks')
    .toDate(),
  numAdditional: 0,
  onClickUser: action('onClickUser'),
}

const multiFollowProps2: Props = {
  type: 'notification',
  newFollows: [
    C.makeFollowedNotification({username: 'max'}),
    C.makeFollowedNotification({username: 'mmaxim'}),
    C.makeFollowedNotification({username: 'chrisnojima'}),
    C.makeFollowedNotification({username: 'chris'}),
  ],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'months')
    .toDate(),
  numAdditional: 5,
  onClickUser: action('onClickUser'),
}

const load = () => {
  storiesOf('People/Follow notification', module)
    .addDecorator(provider)
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
    .add('A few people followed you', () => <FollowNotification {...multiFollowProps1} />)
    .add('Many people followed you', () => <FollowNotification {...multiFollowProps2} />)
}

export default load
