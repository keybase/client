// @flow
import File from './files/file/render'
import Files from './files/render'
import Folders from './render'
import type {Folder} from './list'
import type {Props as FilesProps} from './files/render'
import type {PropsOf, DumbComponentMap} from '../constants/types/more'
import {globalStyles} from '../styles'
import {pathFromFolder} from '../constants/favorite'

function createFolder(partialFolder: $Shape<Folder>) {
  return {...partialFolder, ...pathFromFolder(partialFolder)}
}

const mockUsers = [
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
  {username: 'chris13'},
]

const f1: Folder = createFolder({
  users: mockUsers,
  meta: 'new',
  ignored: false,
  isPublic: false,
  hasData: true,
  groupAvatar: true,
  userAvatar: null,
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const f2: Folder = createFolder({
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true},
    {username: 'throughnothing'},
  ],
  modified: {
    when: '2 hours ago',
    username: 'jeresig',
  },
  ignored: false,
  isPublic: false,
  hasData: true,
  groupAvatar: true,
  userAvatar: null,
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const f3: Folder = createFolder({
  users: [{username: 'cecileb', you: true}, {username: 'bob'}],
  modified: {
    when: '3 hours ago',
    username: 'bob',
  },
  ignored: false,
  isPublic: false,
  hasData: true,
  groupAvatar: false,
  userAvatar: 'bob',
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const f4: Folder = createFolder({
  users: [{username: 'cecileb', you: true}, {username: 'jenbee'}],
  ignored: false,
  isPublic: false,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jenbee',
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const f5: Folder = createFolder({
  users: [{username: 'cecileb', you: true}],
  ignored: false,
  isPublic: false,
  hasData: true,
  groupAvatar: false,
  userAvatar: 'cecileb',
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const f6: Folder = createFolder({
  path: '/keybase/private/cecileb,jenbeeb',
  users: [{username: 'cecileb', you: true}, {username: 'jenbeeb'}],
  meta: 'rekey',
  ignored: false,
  isPublic: false,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jenbee',
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const tlfs: Array<Folder> = [f1, f2, f3, f4, f5, f6]

const i1: Folder = createFolder({
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true},
    {username: 'cdixon'},
  ],
  ignored: true,
  isPublic: false,
  hasData: true,
  groupAvatar: true,
  userAvatar: null,
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const i2: Folder = createFolder({
  users: [
    {username: 'cecileb', you: true},
    {username: 'jeresig', broken: true},
  ],
  ignored: true,
  isPublic: false,
  hasData: false,
  groupAvatar: false,
  userAvatar: 'jeresig',
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
})

const ignored: Array<Folder> = [i1, i2]

const parentProps = {
  style: {
    ...globalStyles.flexBoxColumn,
    width: 325,
    height: 350,
    padding: 2,
    backgroundColor: 'red',
  },
}

const onToggleShowIgnored = () => console.log('toggle')

const commonFolders = {
  smallMode: false,
  onRekey: path => console.log(`open rekey page: ${path}`),
  onChat: tlf => console.log(`open chat with tlf ${tlf}`),
  onToggleShowIgnored,
  username: 'cecileb',
  private: {
    tlfs,
    ignored,
    isPublic: false,
    parentProps,
    onToggleShowIgnored,
    showIgnored: true,
  },
  public: {
    tlfs: [f2, f3, f4, f5],
    ignored,
    isPublic: true,
    privateBadge: 1,
    publicBadge: 222,
    parentProps,
    onToggleShowIgnored,
    showIgnored: false,
  },
  showingPrivate: true,
  showingIgnored: true,
}

const map: DumbComponentMap<Folders> = {
  component: Folders,
  mocks: {
    'Normal Private': {...commonFolders},
    'Normal Private - Hide Ignored': {...commonFolders, showingIgnored: false},
    'Normal Public - Hide Ignored': {
      ...commonFolders,
      showingPrivate: false,
      showingIgnored: false,
    },
    'Normal Public': {
      ...commonFolders,
      showingPrivate: false,
    },
  },
}

const longFile =
  'To be or not to be-that is the question: Whether tis nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And, by opposing, end them.rtf'

const commonFile = {
  theme: 'private',
  name: 'How-PGP-works.doc',
  path: '2016-tutorial/',
  lastModifiedMeta: '2 hours ago',
  lastModifiedBy: 'jenbee',
  modifiedMarker: true,
  fileIcon: 'icon-keybase-logo-128',
  onClick: () => console.log('onClick:file'),
}

const file: DumbComponentMap<File> = {
  component: File,
  mocks: {
    'Normal Private': {
      ...commonFile,
    },
    'Normal Private Long': {
      ...commonFile,
    },
    'Normal Private modified by self long file': {
      ...commonFile,
      name: longFile,
      lastModifiedBy: 'marcopolo',
      lastModifiedBySelf: true,
    },
    'Normal Public': {
      ...commonFile,
      parentProps: {
        style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'},
      },
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/',
    },
    'Normal Public No Modified meta': {
      ...commonFile,
      parentProps: {
        style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'},
      },
      lastModifiedMeta: undefined,
      lastModifiedBy: undefined,
      theme: 'public',
      name: 'Cute Sloth.jpg',
      path: 'spirit-animals/',
      modifiedMarker: false,
    },
  },
}

function genFiles(
  offsetNumber: number,
  fileCount: number,
  isPrivate: boolean
): Array<PropsOf<File>> {
  const adjs = [
    'tiresome',
    'longing',
    'marvelous',
    'bloody',
    'cruel',
    'descriptive',
    'cooperative',
    'parallel',
    'discreet',
    'wry',
    'lovely',
    'mysterious',
  ]
  const nouns = [
    'maid',
    'river',
    'pan',
    longFile,
    'transport',
    'reason',
    'dog',
    'food',
    'ice',
    'wilderness',
    'level',
    'horse',
  ]

  const wordGen = (i: number) =>
    // eslint-disable-next-line
    `${adjs[Math.floor(i / 12) % (12 * 12)]}-${nouns[i % 12]}.jpg`

  const results = []
  for (let i = offsetNumber; i < fileCount + offsetNumber; i++) {
    results.push({
      parentProps: {
        style: {borderColor: 'black', borderWidth: 1, borderStyle: 'solid'},
      },
      theme: isPrivate ? 'private' : 'public',
      name: wordGen(i),
      path: 'pics/',
      modifiedMarker: false,
      fileIcon: 'icon-keybase-logo-128',
      onClick: () => console.log('onClick:file', wordGen(i)),
    })
  }

  return results
}

const popupItemCommon = {
  onClick: () => console.log('item clicked'),
}

const filesMenuItems = [
  {...popupItemCommon, title: 'Open in Finder'},
  {...popupItemCommon, title: 'Ignore'},
  'Divider',
  {
    ...popupItemCommon,
    title: 'Clear history (3.24 MB)',
    subTitle: 'Deletes old copies of files.',
    danger: true,
  },
  {
    ...popupItemCommon,
    title: 'Delete files and clear history (5.17GB)',
    subTitle: 'Deletes everything in this folder, including its backup versions',
    danger: true,
  },
]

const commonFiles = (isPrivate): FilesProps => ({
  theme: isPrivate ? 'private' : 'public',
  ignored: false,
  allowIgnore: true,
  hasReadOnlyUsers: false,
  visiblePopupMenu: false,
  popupMenuItems: filesMenuItems,
  selfUsername: 'cecileb',
  users: [{username: 'cecileb', you: true}, {username: 'aliceb'}],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
  onBack: () => console.log('onBack:files'),
  openCurrentFolder: () => console.log('open current folder'),
  openConversationFromFolder: () => console.log('open tlf in chat'),
  ignoreCurrentFolder: () => console.log('ignore current folder'),
  unIgnoreCurrentFolder: () => console.log('unignore current folder'),
  onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
  recentFilesSection: [
    {name: 'Today', modifiedMarker: true, files: genFiles(0, 4, isPrivate)},
    {
      name: 'Yesterday',
      modifiedMarker: false,
      files: genFiles(4, 4, isPrivate),
    },
  ],
  recentFilesEnabled: true,
  onClickPaperkey: device => console.log('on click paperkey ', device),
})

const commonParticipant = {
  recentFilesSection: [],
  waitingForParticipantUnlock: [
    {
      name: 'throughnothing',
      devices: "Tell them to turn on: Home Computer, ben's iPhone or Work laptop.",
    },
    {name: 'bob', devices: "Tell them to turn on bob's Android phone"},
  ],
}

const commonUnlock = {
  recentFilesSection: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [
    {name: 'Work Computer', type: 'desktop', deviceID: '1'},
    {name: 'Home Computer', type: 'desktop', deviceID: '2'},
    {name: "Cecil's iPhone", type: 'mobile', deviceID: '3'},
    {name: 'project green...', type: 'backup', deviceID: '4'},
    {name: 'gumball sparkles...', type: 'backup', deviceID: '5'},
  ],
}

const files: DumbComponentMap<Files> = {
  component: Files,
  mocks: {
    'Normal - Public': {
      ...commonFiles(false),
    },
    'Not Implemented - Public': {
      ...commonFiles(false),
    },
    'Not Implemented - Public - lotsa users': {
      ...commonFiles(false),
      users: mockUsers,
    },
    'Popup - Public': {
      ...commonFiles(false),
      visiblePopupMenu: true,
    },
    'Normal - Private': {
      ...commonFiles(true),
    },
    'Not Implemented - Private': {
      ...commonFiles(true),
    },
    'Not Implemented - Private - lotsa users': {
      ...commonFiles(true),
      users: mockUsers,
    },
    'Popup - Private': {
      ...commonFiles(true),
      visiblePopupMenu: true,
    },
    'No files - Public': {
      ...commonFiles(false),
      recentFilesSection: [],
    },
    'No files - Private': {
      ...commonFiles(true),
      recentFilesSection: [],
    },
    'Participant Unlock - Public': {
      ...commonFiles(false),
      ...commonParticipant,
    },
    'Participant Unlock - Private': {
      ...commonFiles(true),
      ...commonParticipant,
    },
    'You can unlock - Public': {
      ...commonFiles(false),
      ...commonUnlock,
    },
    'You can unlock - Private': {
      ...commonFiles(true),
      ...commonUnlock,
    },
    'Recent Files Disabled - Private': {
      ...commonFiles(true),
      recentFilesSection: undefined,
      recentFilesEnabled: false,
    },
    'Recent Files Disabled - Private - You': {
      ...commonFiles(true),
      recentFilesSection: undefined,
      recentFilesEnabled: false,
      users: [{username: 'cecileb', you: true}],
      allowIgnore: false,
    },
    'Recent Files Disabled - Public': {
      ...commonFiles(false),
      recentFilesSection: undefined,
      recentFilesEnabled: false,
    },
  },
}

export default {
  'Folders: TLF': map,
  'Folders: Files': files,
  'Folders: File': file,
}

export {createFolder, map, file, files}
