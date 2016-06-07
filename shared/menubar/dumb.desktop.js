// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import {map} from '../folders/dumb'
import {globalStyles} from '../styles/style-guide'

const propsNormal = {
  folderProps: map.mocks.Normal,
  username: 'max',
  showKBFS: () => console.log('show kbfs'),
  logIn: () => console.log('login'),
  showHelp: () => console.log('show help'),
  showUser: () => console.log('show user'),
  quit: () => console.log('quit'),
  refresh: () => console.log('refresh'),
  showBug: () => console.log('showbug'),
  onRekey: () => console.log('rekey popup'),
  loggedIn: true,
  parentProps: {
    style: {
      ...globalStyles.flexBoxColumn,
      width: 325,
      height: 350,
      padding: 2,
      backgroundColor: 'red'
    }
  }
}

const dumbComponentMap: DumbComponentMap<Menubar> = {
  component: Menubar,
  mocks: {
    'Truncated': {
      ...propsNormal,
      parentProps: {
        style: {
          ...globalStyles.flexBoxColumn,
          width: 325,
          height: 200,
          padding: 2,
          backgroundColor: 'red'
        }
      }
    },
    'Normal': propsNormal,
    'LoggedOut': {
      ...propsNormal,
      loggedIn: false
    }
  }
}

export default {
  'Menubar': dumbComponentMap
}
