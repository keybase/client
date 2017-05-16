// @flow
import {initLookup, initLoad} from './avatar'
import type {AvatarLookup, AvatarLoad} from './avatar'

const initAvatarLookup = (lookup: AvatarLookup) => {
  initLookup(lookup)
}

const initAvatarLoad = (load: AvatarLoad) => {
  initLoad(load)
}

export {initAvatarLookup, initAvatarLoad}
