// @flow

import Friendships from './friendships'
import type {DumbComponentMap} from '../constants/types/more'
import type {Props} from './friendships'

const propsNormal: Props = {
  currentTab: 'FOLLOWERS',
  onSwitchTab: selected => { console.log('friendships:onSwitchTab', selected) },
  onUserClick: username => { console.log('friendships:onUserClick', username) },
  followers: [
    {username: 'awendland', fullname: 'Alex Wendland', followsYou: true, following: false},
    {username: 'marcopolo', fullname: 'Marco Munizaga', followsYou: false, following: false},
    {username: 'chromakode', fullname: 'Max Goodman', followsYou: true, following: true},
    {username: 'strib', fullname: 'Jeremy Stribling', followsYou: false, following: true},
    {username: 'chris', fullname: 'Chris Vendle', followsYou: false, following: false},
    {username: 'thor', fullname: 'Thor Asgard', followsYou: false, following: true},
    {username: 'alex', fullname: 'Alexander The-Gret', followsYou: true, following: false},
    {username: 'daniel', fullname: 'Daniel Steven', followsYou: true, following: true},
  ],
  following: [
    {username: 'zanderz', fullname: 'Steve Sanders', followsYou: false, following: false},
    {username: 'awendland', fullname: 'Alex Wendland', followsYou: true, following: false},
    {username: 'strib', fullname: 'Jeremy Stribling', followsYou: false, following: true},
  ],
}

const dumbComponentMap: DumbComponentMap<Friendships> = {
  component: Friendships,
  mocks: {
    'Followers': propsNormal,
    'Following': {
      ...propsNormal,
      currentTab: 'FOLLOWING',
    },
  },
}

export default {
  'Friendships': dumbComponentMap,
}
