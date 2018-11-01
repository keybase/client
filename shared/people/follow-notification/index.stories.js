// @flow
import * as React from 'react'
import * as C from '../../constants/people'
import * as Sb from '../../stories/storybook'
import FollowNotification from '.'
import moment from 'moment'

const singleFollowProps1 = {
  type: 'notification',
  newFollows: [C.makeFollowedNotification({username: 'mmaxim'})],
  badged: true,
  notificationTime: new Date(),
  onClickUser: Sb.action('onClickUser'),
}

const singleFollowProps2 = {
  type: 'notification',
  newFollows: [C.makeFollowedNotification({username: 'max'})],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'days')
    .toDate(),
  onClickUser: Sb.action('onClickUser'),
}

const multiFollowProps1 = {
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
  onClickUser: Sb.action('onClickUser'),
}

const multiFollowProps2 = {
  type: 'notification',
  newFollows: [
    C.makeFollowedNotification({username: 'max'}),
    C.makeFollowedNotification({username: 'mmaxim'}),
    C.makeFollowedNotification({username: 'chrisnojima'}),
    C.makeFollowedNotification({username: 'chris'}),
    C.makeFollowedNotification({username: 'jzila'}),
    C.makeFollowedNotification({username: 'akalin'}),
    C.makeFollowedNotification({username: 'zanderz'}),
    C.makeFollowedNotification({username: 'songgao'}),
    C.makeFollowedNotification({username: 'strib'}),
    C.makeFollowedNotification({username: 'oconnor663'}),
    C.makeFollowedNotification({username: 'mlsteele'}),
    C.makeFollowedNotification({username: 'joshblum'}),
  ],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'months')
    .toDate(),
  numAdditional: 5,
  onClickUser: Sb.action('onClickUser'),
}

const load = () => {
  Sb.storiesOf('People/Follow notification', module)
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
    .add('A few people followed you', () => <FollowNotification {...multiFollowProps1} />)
    .add('Many people followed you', () => <FollowNotification {...multiFollowProps2} />)
}

export default load
