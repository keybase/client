/* @flow */
import Folders from './render'
import Files from './files/render'
import File from './files/file/render'
import type {PropsOf} from '../constants/types/more'
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

export const file: DumbComponentMap<File> = {
  component: File,
  mocks: {
    'Normal Private': {
      theme: 'private',
      name: 'How-PGP-works.doc',
      path: '2016-tutorial/',
      lastModifiedMeta: '2 hours ago',
      lastModifiedBy: 'jenbee',
      modifiedMarker: true,
      fileIcon: 'logo-128',
      onClick: () => console.log('onClick:file')
    },
    'Normal Private modified by self': {
      theme: 'private',
      name: 'How-PGP-works.doc',
      path: '2016-tutorial/',
      lastModifiedMeta: '2 hours ago',
      lastModifiedBy: 'marcopolo',
      lastModifiedBySelf: true,
      modifiedMarker: true,
      fileIcon: 'logo-128',
      onClick: () => console.log('onClick:file')
    },
    'Normal Public': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'}},
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/',
      lastModifiedMeta: '2 hours ago',
      lastModifiedBy: 'jenbee',
      modifiedMarker: true,
      fileIcon: 'logo-128',
      onClick: () => console.log('onClick:file')
    },
    'Normal Public No Modified meta': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'}},
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/',
      modifiedMarker: false,
      fileIcon: 'logo-128',
      onClick: () => console.log('onClick:file')
    }
  }
}

function genFiles (offsetNumber: number, fileCount: number, isPrivate: boolean): Array<PropsOf<File>> {
  const adjs = ['tiresome', 'longing', 'marvelous', 'bloody', 'cruel', 'descriptive', 'cooperative', 'parallel', 'discreet', 'wry', 'lovely', 'mysterious']
  const nouns = ['maid', 'river', 'pan', 'house', 'transport', 'reason', 'dog', 'food', 'ice', 'wilderness', 'level', 'horse']

  const wordGen = (i: number) => `${adjs[Math.floor(i/12)%(12*12)]}-${nouns[i%12]}.jpg` // eslint-disable-line

  const results = []
  for (let i = offsetNumber; i < fileCount + offsetNumber; i++) {
    results.push({
      parentProps: {style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'}},
      theme: isPrivate ? 'private' : 'public',
      name: wordGen(i),
      path: 'pics/',
      modifiedMarker: false,
      fileIcon: 'logo-128',
      onClick: () => console.log('onClick:file', wordGen(i))
    })
  }

  return results
}

const filesMenuItems = [
  {title: 'Item 1', onClick: () => {}},
  {title: 'Item 2', onClick: () => {}}
]

export const files: DumbComponentMap<Files> = {
  component: Files,
  mocks: {
    'Normal - Public': {
      theme: 'public',
      visiblePopupMenu: false,
      popupMenuItems: filesMenuItems,
      selfUsername: 'cecileb',
      users: ['cecileb', 'aliceb'],
      onBack: () => console.log('onBack:files'),
      onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
      recentFilesSection: [
        {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, false)},
        {name: 'Yesterday', modifiedMarker: false, files: genFiles(4, 4, false)}
      ]
    },
    'Popup - Public': {
      theme: 'public',
      visiblePopupMenu: true,
      popupMenuItems: filesMenuItems,
      selfUsername: 'cecileb',
      users: ['cecileb', 'aliceb'],
      onBack: () => console.log('onBack:files'),
      onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
      recentFilesSection: [
        {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, false)},
        {name: 'Yesterday', modifiedMarker: false, files: genFiles(4, 4, false)}
      ]
    },
    'Normal - Private': {
      theme: 'private',
      visiblePopupMenu: false,
      popupMenuItems: filesMenuItems,
      selfUsername: 'cecileb',
      users: ['cecileb', 'aliceb'],
      onBack: () => console.log('onBack:files'),
      onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
      recentFilesSection: [
        {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, true)},
        {name: 'Yesterday', modifiedMarker: false, files: genFiles(4, 4, true)}
      ]
    },
    'Popup - Private': {
      theme: 'private',
      selfUsername: 'cecileb',
      users: ['cecileb', 'aliceb'],
      onBack: () => console.log('onBack:files'),
      onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
      visiblePopupMenu: true,
      popupMenuItems: filesMenuItems,
      recentFilesSection: [
        {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, true)},
        {name: 'Yesterday', modifiedMarker: false, files: genFiles(4, 4, true)}
      ]
    }
  }
}

export default {
  'Folders TLF': map,
  'Files': files,
  'File': file
}
