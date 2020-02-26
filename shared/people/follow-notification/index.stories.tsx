import * as React from 'react'
import * as C from '../../constants/people'
import * as Sb from '../../stories/storybook'
import FollowNotification from '.'
import * as dateFns from 'date-fns'

const singleFollowProps1 = {
  badged: true,
  newFollows: [C.makeFollowedNotification({username: 'mmaxim'})],
  notificationTime: new Date(),
  onClickUser: Sb.action('onClickUser'),
  type: 'follow' as const,
}

const singleContactProps = {
  badged: true,
  newFollows: [
    C.makeFollowedNotification({contactDescription: 'Ja[ck]ob without the hair', username: 'jakob223'}),
  ],
  notificationTime: new Date(),
  onClickUser: Sb.action('onClickUser'),
  type: 'contact' as const,
}

const singleFollowProps2 = {
  badged: false,
  newFollows: [C.makeFollowedNotification({username: 'max'})],
  notificationTime: dateFns.sub(new Date(), {days: 3}),
  onClickUser: Sb.action('onClickUser'),
  type: 'follow' as const,
}

const multiFollowProps1 = {
  badged: true,
  newFollows: [
    C.makeFollowedNotification({username: 'max'}),
    C.makeFollowedNotification({username: 'mmaxim'}),
    C.makeFollowedNotification({username: 'chrisnojima'}),
  ],
  notificationTime: dateFns.sub(new Date(), {days: 21}), // 3 weeks
  numAdditional: 0,
  onClickUser: Sb.action('onClickUser'),
  type: 'follow' as const,
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
  notificationTime: dateFns.sub(new Date(), {months: 3}),
  numAdditional: 5,
  onClickUser: Sb.action('onClickUser'),
  type: 'follow' as const,
}

const load = () => {
  Sb.storiesOf('People/Follow notification', module)
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    .add('Your contact joined Keybase', () => <FollowNotification {...singleContactProps} />)
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
    .add('A few people followed you', () => <FollowNotification {...multiFollowProps1} />)
    .add('Many people followed you', () => <FollowNotification {...multiFollowProps2} />)
}

export default load
