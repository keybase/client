/* @flow */
import Folders from './render'
import type {Folder} from './list'
import type {DumbComponentMap} from '../constants/types/more'
import {globalStyles} from '../styles/style-guide'

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
  hasData: true,
  groupAvatar: true,
  userAvatar: null
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
  hasData: true,
  groupAvatar: true,
  userAvatar: null
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
  hasData: true,
  groupAvatar: false,
  userAvatar: 'bob'
}

const f4: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jenbee'}
  ],
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jenbee'
}

const f5: Folder = {
  users: [
    {username: 'cecileb', you: true}
  ],
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: true,
  groupAvatar: false,
  userAvatar: 'cecileb'
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
  hasData: true,
  groupAvatar: true,
  userAvatar: null
}

const i2: Folder = {
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true}
  ],
  ignored: true,
  isPublic: false,
  isFirst: true,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jeresig'
}

const ignored: Array<Folder> = [i1, i2]

const parentProps = {
  style: {
    ...globalStyles.flexBoxColumn,
    width: 325,
    height: 350,
    padding: 2,
    backgroundColor: 'red'
  }
}

export const map: DumbComponentMap<Folders> = {
  component: Folders,
  mocks: {
    'Normal': {
      private: {tlfs, ignored, isPublic: false, parentProps},
      public: {tlfs: [f2, f3, f4, f5], ignored, isPublic: true, privateBadge: 1, publicBadge: 222, parentProps}
    }
  }
}

export default {
  'Folders TLF': map
}
