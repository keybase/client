/* @flow */
import Folders from './render'
import type {Folder} from './render'

const f1: Folder = {
  name: 'Paper Key (lorem ipsum...)'
}

const ig1: Folder = {
  name: 'blah'
}

const tlfs: Array<Folder> = [
  f1
]

const ignored: Array<Folder> = [
  ig1
]

export default {
  'Folders TLF': {
    component: Folders,
    mocks: {
      'Private': {tlfs, ignored, isPublic: false},
      'Public': {tlfs, ignored, isPublic: true}
    }
  }
}
