// @flow
import {initLookup, initLoad} from './avatar'
import type {AvatarLookup, AvatarLoad, TeamAvatarLookup, TeamAvatarLoad} from './avatar'

const initAvatarLookup = (lookupAvatar: AvatarLookup, lookupTeam: TeamAvatarLookup) => {
  initLookup(lookupAvatar, lookupTeam)
}

const initAvatarLoad = (loadAvatar: AvatarLoad, loadTeam: TeamAvatarLoad) => {
  initLoad(loadAvatar, loadTeam)
}

export {initAvatarLookup, initAvatarLoad}
