// @flow

import Menubar from './index.render'
import type {DumbComponentMap} from '../constants/types/more'

const folder1 = {
  type: 'folder',
  folderName: 'max,chris',
  isPublic: true,
  isEmpty: false,
  openFolder: () => {}
}

const folderLong = {
  type: 'folder',
  folderName: 'max,chris,marcopolo,patrick,strib,mgood,zanderz,gabrielh,chrisnojima,cbostrander,alness,akalin',
  isPublic: true,
  isEmpty: false,
  openFolder: () => {}
}

const folder2 = {
  type: 'folder',
  folderName: 'mgood,strib,marcopolo',
  isPublic: true,
  isEmpty: false,
  openFolder: () => {}
}

const propsNormal = {
  username: 'max',
  openKBFS: () => {},
  openKBFSPublic: username => {},
  logIn: () => {},
  openKBFSPrivate: username => {},
  showMain: () => {},
  showHelp: () => {},
  showUser: username => {},
  quit: () => {},
  folders: [
    folder1,
    folderLong,
    folder2
  ],
  debug: false,
  loading: false,
  loggedIn: true
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
