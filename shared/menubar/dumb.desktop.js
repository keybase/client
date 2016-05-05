// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import {map} from '../folders/dumb'
import {globalStyles} from '../styles/style-guide'

const propsNormal = {
  folderProps: map.mocks.Normal,
  username: 'max',
  openKBFS: path => { console.log('Opening finder: ', path) },
  showKBFS: () => {},
  logIn: () => {},
  showHelp: () => {},
  showUser: () => {},
  quit: () => {},
  refresh: () => {},
  showBug: () => {},
  loading: false,
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
