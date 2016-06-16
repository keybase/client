// @flow

import Friendships from './friendships'
import type {DumbComponentMap} from '../constants/types/more'
import type {Props} from './friendships'

const propsNormal: Props = {
  currentTab: 'Followers',
  onSwitchTab: selected => { console.log('friendships:onSwitchTab', selected) },
  onUserClick: username => { console.log('friendships:onUserClick', username) },
  followers: [
    {username: 'bbbbbbbbbbbbbbbb', fullname: 'Alex Wendland', followsYou: true, following: false},
    {username: 'bbbbbbbbbbbbbbbc', fullname: 'Marco Munizaga', followsYou: false, following: false},
    {username: 'chromakode', fullname: 'Max Goodman', followsYou: true, following: true},
    {username: 'strib', fullname: 'Jeremy Stribling', followsYou: false, following: true},
    {username: 'chris', fullname: 'Chris Vendle', followsYou: true, following: false},
    {username: 'thor', fullname: 'Thor Asgard', followsYou: false, following: true},
    {username: 'alex', fullname: 'Alexander The-Great', followsYou: true, following: false},
    {username: 'daniel', fullname: 'Daniel Steven', followsYou: true, following: true},
    {username: 'edward', fullname: 'Edward Scissorhands', followsYou: false, following: false},
    {username: 'fernando', fullname: 'Fernando Magnolius', followsYou: false, following: true},
    {username: 'gilbert', fullname: 'Gilbert Grey', followsYou: false, following: false},
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
      currentTab: 'Following',
    },
  },
}

export default {
  'Friendships': dumbComponentMap,
}
