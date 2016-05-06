/* @flow */
import Folders from './render'
import type {Folder} from './list'
import type {DumbComponentMap} from '../constants/types/more'

const f1: Folder = {
  users: [
    {username: 'cecileb', you: true},
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
  meta: 'new',
  ignored: false,
  isPublic: false,
  isFirst: true,
  hasData: true
}

const f2: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true},
    {username: 'throughnothing'}
  ],
  modified: {
    when: '2 hours ago',
    username: 'jeresig'
  },
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: true
}

const f3: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'bob'}
  ],
  modified: {
    when: '3 hours ago',
    username: 'bob'
  },
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: true
}

const f4: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jenbee'}
  ],
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: false
}

const f5: Folder = {
  users: [
    {username: 'cecileb', you: true}
  ],
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: true
}

const tlfs: Array<Folder> = [f1, f2, f3, f4, f5]

const i1: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true},
    {username: 'cdixon'}
  ],
  ignored: true,
  isPublic: false,
  isFirst: true,
  hasData: true
}

const i2: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true}
  ],
  ignored: true,
  isPublic: false,
  isFirst: true,
  hasData: false
}

const ignored: Array<Folder> = [i1, i2]

const map: DumbComponentMap<Folders> = {
  component: Folders,
  mocks: {
    'Normal': {
      private: {tlfs, ignored, isPublic: false},
      public: {tlfs, ignored, isPublic: true},
      privateBadge: 1, publicBadge: 2, parentProps: {height: 580}}
  }
}

export default {
  'Folders TLF': map
}
