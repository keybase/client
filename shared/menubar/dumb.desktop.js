// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import {map} from '../folders/dumb'
import {globalStyles} from '../styles'

const propsNormal = {
  badgeInfo: {
    folderBadge: 0,
    peopleBadge: 0,
    chatBadge: 0,
    deviceBadge: 0,
  },
  folderProps: map.mocks['Normal Private'],
  username: 'max',
  kbfsStatus: {
    isAsyncWriteHappening: false,
  },
  onFolderClick: () => console.log('folder clicked'),
  openApp: () => console.log('open app'),
  showKBFS: () => console.log('show kbfs'),
  logIn: () => console.log('login'),
  showHelp: () => console.log('show help'),
  showUser: () => console.log('show user'),
  openShell: () => console.log('open shell'),
  quit: () => console.log('quit'),
  refresh: () => console.log('refresh'),
  onRekey: () => console.log('rekey popup'),
  showBug: () => console.log('show bug'),
  loggedIn: true,
  parentProps: {
    style: {
      ...globalStyles.flexBoxColumn,
      width: 325,
      height: 350,
      padding: 2,
      backgroundColor: 'red',
    },
  },
}

const propsTruncated = {
  ...propsNormal,
  parentProps: {
    style: {
      ...globalStyles.flexBoxColumn,
      width: 325,
      height: 200,
      padding: 2,
      backgroundColor: 'red',
    },
  },
}

const propsMenuShowing = {...propsNormal, openWithMenuShowing: true}

const dumbComponentMap: DumbComponentMap<Menubar> = {
  component: Menubar,
  mocks: {
    'Private: Normal': propsNormal,
    'Private: Truncated': propsTruncated,
    'Private: Menu Showing': propsMenuShowing,
    'Private: Async Writing': {
      ...propsNormal,
      kbfsStatus: {isAsyncWriteHappening: true},
    },
    'Public: Normal': {...propsNormal, openToPrivate: false},
    'Public: Truncated': {...propsTruncated, openToPrivate: false},
    'Public: Menu Showing': {...propsMenuShowing, openToPrivate: false},
    'Badge Folder': {
      ...propsNormal,
      badgeInfo: {...propsNormal.badgeInfo, folderBadge: 2},
    },
    'Badge People': {
      ...propsNormal,
      badgeInfo: {...propsNormal.badgeInfo, peopleBadge: 3},
    },
    'Badge Chat': {
      ...propsNormal,
      badgeInfo: {...propsNormal.badgeInfo, chatBadge: 2000},
    },
    'Badge Device': {
      ...propsNormal,
      badgeInfo: {...propsNormal.badgeInfo, deviceBadge: 3},
    },
    'Badge PeopleChat': {
      ...propsNormal,
      badgeInfo: {...propsNormal.badgeInfo, peopleBadge: 2, chatBadge: 3000},
    },
    LoggedOut: {
      ...propsNormal,
      loggedIn: false,
    },
    'LoggedOut Menu Showing': {
      ...propsMenuShowing,
      loggedIn: false,
    },
  },
}

export default {
  Menubar: dumbComponentMap,
}
