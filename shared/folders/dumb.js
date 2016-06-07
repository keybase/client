/* @flow */
import Folders from './render'
import Files from './files/render'
import File from './files/file/render'
import type {PropsOf} from '../constants/types/more'
import type {Folder} from './list'
import type {DumbComponentMap} from '../constants/types/more'
import {globalStyles} from '../styles/style-guide'

const f1: Folder = {
  path: '/keybase/private/cecileb,jeresig,throughnothing,cdixon,bob,aliceb,lmorchard,chris,chris1,chris2,chris3,chris4,chris5,chris6,chris7,chris8,chris9,chris10,chris11,chris12,chris13',
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
  path: '/keybase/private/cecileb,jeresig,throughnothing',
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
  path: '/keybase/private/cecileb,bob',
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
  path: '/keybase/private/cecileb,jenbee',
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
  path: '/keybase/private/cecileb',
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

const f6: Folder = {
  path: '/keybase/private/cecileb,jenbeeb',
  users: [
    {username: 'cecileb', you: true},
    {username: 'jenbeeb'}
  ],
  meta: 'rekey',
  ignored: false,
  isPublic: false,
  isFirst: false,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jenbee'
}

const tlfs: Array<Folder> = [f1, f2, f3, f4, f5, f6]

const i1: Folder = {
  path: '/keybase/private/cecileb,jeresig,cdixon',
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
  path: '/keybase/private/cecileb,jeresig',
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
      smallMode: false,
      onRekey: path => console.log(`open rekey page: ${path}`),
      showComingSoon: false,
      private: {tlfs, ignored, isPublic: false, parentProps},
      public: {tlfs: [f2, f3, f4, f5], ignored, isPublic: true, privateBadge: 1, publicBadge: 222, parentProps}
    },
    'ComingSoon': {
      smallMode: false,
      onRekey: path => console.log(`open rekey page: ${path}`),
      showComingSoon: true,
      private: {tlfs, ignored, isPublic: false, parentProps},
      public: {tlfs: [f2, f3, f4, f5], ignored, isPublic: true, privateBadge: 1, publicBadge: 222, parentProps}
    }
  }
}

const longFile = 'To be or not to be-that is the question: Whether tis nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And, by opposing, end them.rtf'

const commonFile = {
  theme: 'private',
  name: 'How-PGP-works.doc',
  path: '2016-tutorial/',
  lastModifiedMeta: '2 hours ago',
  lastModifiedBy: 'jenbee',
  modifiedMarker: true,
  fileIcon: 'logo-128',
  onClick: () => console.log('onClick:file')
}

export const file: DumbComponentMap<File> = {
  component: File,
  mocks: {
    'Normal Private': {
      ...commonFile
    },
    'Normal Private Long': {
      ...commonFile
    },
    'Normal Private modified by self long file': {
      ...commonFile,
      name: longFile,
      lastModifiedBy: 'marcopolo',
      lastModifiedBySelf: true
    },
    'Normal Public': {
      ...commonFile,
      parentProps: {style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'}},
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/'
    },
    'Normal Public No Modified meta': {
      ...commonFile,
      parentProps: {style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'}},
      lastModifiedMeta: undefined,
      lastModifiedBy: undefined,
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/',
      modifiedMarker: false
    }
  }
}

function genFiles (offsetNumber: number, fileCount: number, isPrivate: boolean): Array<PropsOf<File>> {
  const adjs = ['tiresome', 'longing', 'marvelous', 'bloody', 'cruel', 'descriptive', 'cooperative', 'parallel', 'discreet', 'wry', 'lovely', 'mysterious']
  const nouns = ['maid', 'river', 'pan', longFile, 'transport', 'reason', 'dog', 'food', 'ice', 'wilderness', 'level', 'horse']

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

const popupItemCommon = {
  onClick: () => console.log('item clicked')
}

const filesMenuItems = [
  {...popupItemCommon, title: 'Open in Finder'},
  {...popupItemCommon, title: 'Ignore'},
  'Divider',
  {...popupItemCommon, title: 'Clear history (3.24 MB)', subTitle: 'Deletes old copies of files.', danger: true},
  {...popupItemCommon, title: 'Delete files and clear history (5.17GB)', subTitle: 'Deletes everything in this folder, including its backup versions', danger: true}
]

const commonFiles = isPrivate => ({
  theme: isPrivate ? 'private' : 'public',
  visiblePopupMenu: false,
  popupMenuItems: filesMenuItems,
  selfUsername: 'cecileb',
  users: [
    {username: 'cecileb', you: true},
    {username: 'aliceb'}],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
  onBack: () => console.log('onBack:files'),
  openCurrentFolder: () => console.log('open current folder'),
  onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
  recentFilesSection: [
    {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, isPrivate)},
    {name: 'Yesterday', modifiedMarker: false, files: genFiles(4, 4, isPrivate)}
  ]
})

const commonParticipant = {
  recentFilesSection: [],
  waitingForParticipantUnlock: [
    {name: 'throughnothing', devices: 'Tell them to turn on: Home Computer, ben\'s iPhone or Work laptop.', onClick: () => console.log('clicked throughnothing')},
    {name: 'bob', devices: 'Tell them to turn on bob\'s Android phone', onClick: () => console.log('clicked bob')}
  ]
}

const commonUnlock = {
  recentFilesSection: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [
    {name: 'Work Computer', icon: 'icon-computer-bw-32'},
    {name: 'Home Computer', icon: 'icon-computer-bw-32'},
    {name: 'Cecil\'s iPhone', icon: 'icon-phone-bw-48'},
    {name: 'project green...', icon: 'icon-paper-key-32', onClickPaperkey: () => console.log('clicked on project green')},
    {name: 'gumball sparkles...', icon: 'icon-paper-key-32', onClickPaperkey: () => console.log('clicked on gumball sparkles')}
  ]
}

export const files: DumbComponentMap<Files> = {
  component: Files,
  mocks: {
    'Normal - Public': {
      ...commonFiles(false)
    },
    'Popup - Public': {
      ...commonFiles(false),
      visiblePopupMenu: true
    },
    'Normal - Private': {
      ...commonFiles(true)
    },
    'Popup - Private': {
      ...commonFiles(true),
      visiblePopupMenu: true
    },
    'No files - Public': {
      ...commonFiles(false),
      recentFilesSection: []
    },
    'No files - Private': {
      ...commonFiles(true),
      recentFilesSection: []
    },
    'Participant Unlock - Public': {
      ...commonFiles(false),
      ...commonParticipant
    },
    'Participant Unlock - Private': {
      ...commonFiles(true),
      ...commonParticipant
    },
    'You can unlock - Public': {
      ...commonFiles(false),
      ...commonUnlock
    },
    'You can unlock - Private': {
      ...commonFiles(true),
      ...commonUnlock
    }
  }
}

export default {
  'Folders TLF': map,
  'Files': files,
  'File': file
}
