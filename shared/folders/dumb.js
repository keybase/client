/* @flow */
import Folders from './render'
import type {Folder} from './render'
import type {DumbComponentMap} from '../constants/types/more'

const f1: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'jeresig', broken: true},
    {username: 'throughnothing'},
    {username: 'cdixon'},
    {username: 'bob'},
    {username: 'aliceb'},
    {username: 'lmorchard'},
    {username: 'chris'},
    {username: 'chris1'},
    {username: 'chris2'},
    {username: 'chris3'},
    {username: 'chris4'},
    {username: 'chris5'},
    {username: 'chris6'},
    {username: 'chris7'},
    {username: 'chris8'},
    {username: 'chris9'},
    {username: 'chris10'},
    {username: 'chris11'},
    {username: 'chris12'},
    {username: 'chris13'}
  ],
  meta: 'new'
}

const f2: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'jeresig', broken: true},
    {username: 'throughnothing'}
  ],
  modified: {
    when: '2 hours ago',
    username: 'jeresig'
  }
}

const f3: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'bob'}
  ],
  modified: {
    when: '3 hours ago',
    username: 'bob'
  }
}

const f4: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'jenbee'}
  ]
}

const f5: Folder = {
  users: [
    {username: 'cecileb'}
  ]
}

const tlfs: Array<Folder> = [f1, f2, f3, f4, f5]

const i1: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'jeresig', broken: true},
    {username: 'cdixon'}
  ]
}

const i2: Folder = {
  users: [
    {username: 'cecileb'},
    {username: 'jeresig', broken: true}
  ]
}

const ignored: Array<Folder> = [i1, i2]

const map: DumbComponentMap<Folders> = {
  component: Folders,
  mocks: {
    'Private': {tlfs, ignored, isPublic: false, privateBadge: 1, publicBadge: 2, parentProps: {height: 580}},
    'Public': {tlfs, ignored, isPublic: true, privateBadge: 1, publicBadge: 2}
  }
}

export default {
  'Folders TLF': map
}
