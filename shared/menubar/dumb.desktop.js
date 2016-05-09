// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'
import {map} from '../folders/dumb'

const propsNormal = {
  username: 'max',
  openKBFS: path => { console.log('Opening finder: ', path) },
  openKBFSPublic: username => {},
  logIn: () => {},
  openKBFSPrivate: username => {},
  showMain: () => {},
  showHelp: () => {},
  showUser: username => {},
  quit: () => {},
  loading: false,
  loggedIn: true,
  ...map.mocks.Normal,
  parentProps: {
    style: {
      width: 320
    }
  }
}

const dumbComponentMap: DumbComponentMap<Menubar> = {
  component: Menubar,
  mocks: {
    'Normal': propsNormal
  }
}

export default {
  'Menubar': dumbComponentMap
}
