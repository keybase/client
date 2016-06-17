// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import {map} from '../folders/dumb'
import {globalStyles} from '../styles/style-guide'

const propsNormal = {
  folderProps: map.mocks['Normal Private'],
  username: 'max',
  showOpenApp: true,
  onFolderClick: () => console.log('folder clicked'),
  openApp: () => console.log('open app'),
  showKBFS: () => console.log('show kbfs'),
  logIn: () => console.log('login'),
  showHelp: () => console.log('show help'),
  showUser: () => console.log('show user'),
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
    'Public: Normal': {...propsNormal, openToPrivate: false},
    'Public: Truncated': {...propsTruncated, openToPrivate: false},
    'Public: Menu Showing': {...propsMenuShowing, openToPrivate: false},
    'LoggedOut': {
      ...propsNormal,
      loggedIn: false,
    },
  },
}

export default {
  'Menubar': dumbComponentMap,
}
