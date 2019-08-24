import * as React from 'react'
import * as C from '../../constants/people'
import * as Sb from '../../stories/storybook'
import FollowNotification from '.'
import moment from 'moment'

const singleFollowProps1 = {
  badged: true,
  newFollows: [C.makeFollowedNotification({username: 'mmaxim'})],
  notificationTime: new Date(),
  onClickUser: Sb.action('onClickUser'),
  type: 'notification',
}

const singleFollowProps2 = {
  badged: false,
  newFollows: [C.makeFollowedNotification({username: 'max'})],
  notificationTime: moment()
    .subtract(3, 'days')
    .toDate(),
  onClickUser: Sb.action('onClickUser'),
  type: 'notification',
}

const multiFollowProps1 = {
  badged: true,
  newFollows: [
    C.makeFollowedNotification({username: 'max'}),
    C.makeFollowedNotification({username: 'mmaxim'}),
    C.makeFollowedNotification({username: 'chrisnojima'}),
  ],
  notificationTime: moment()
    .subtract(3, 'weeks')
    .toDate(),
  numAdditional: 0,
  onClickUser: Sb.action('onClickUser'),
  type: 'notification',
}

const multiFollowProps2 = {
  badged: false,
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
  notificationTime: moment()
    .subtract(3, 'months')
    .toDate(),
  numAdditional: 5,
  onClickUser: Sb.action('onClickUser'),
  type: 'notification',
}

const load = () => {
  Sb.storiesOf('People/Follow notification', module)
    // @ts-ignore not sure why this is being weird w/ records
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    // @ts-ignore not sure why this is being weird w/ records
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
    // @ts-ignore not sure why this is being weird w/ records
    .add('A few people followed you', () => <FollowNotification {...multiFollowProps1} />)
    // @ts-ignore not sure why this is being weird w/ records
    .add('Many people followed you', () => <FollowNotification {...multiFollowProps2} />)
}

export default load
