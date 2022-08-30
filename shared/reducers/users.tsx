import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/users'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as UsersGen from '../actions/users-gen'
import type * as Types from '../constants/types/users'
import type {Draft} from 'immer'

type WritableDraft<T> = {
  -readonly [K in keyof T]: Draft<T[K]>
}

const initialState: Types.State = Constants.makeState()

type Actions =
  | UsersGen.Actions
  | Tracker2Gen.UpdateFollowsPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | ConfigGen.SetAccountsPayload
  | TeamBuildingGen.SearchResultsLoadedPayload
  | TeamsGen.SetMembersPayload

const updateInfo = (
  map: Map<string, WritableDraft<Types.UserInfo>>,
  username: string,
  info: Partial<Types.UserInfo>
) => {
  const next = map.get(username)
  if (next) {
    Object.keys(info).forEach(key => {
      next[key] = info[key]
    })
  } else {
    map.set(username, info)
  }
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [UsersGen.resetStore]: () => initialState,
  [UsersGen.updateFullnames]: (draftState, action) => {
    const {infoMap} = draftState
    const {usernameToFullname} = action.payload
    for (const [username, fullname] of Object.entries(usernameToFullname)) {
      updateInfo(infoMap, username, {fullname})
    }
  },
  [UsersGen.updateBrokenState]: (draftState, action) => {
    const {newlyBroken, newlyFixed} = action.payload
    const {infoMap} = draftState
    newlyFixed.forEach(username => delete infoMap.get(username)?.broken)
    newlyBroken.forEach(username => updateInfo(infoMap, username, {broken: true}))
  },
  [UsersGen.updateBio]: (draftState, action) => {
    const {username, userCard} = action.payload
    const {bioDecorated} = userCard // using bioDecorated to make links clickable and shruggies whole
    const {infoMap} = draftState
    updateInfo(infoMap, username, {bio: bioDecorated})
  },
  [Tracker2Gen.updatedDetails]: (draftState, action) => {
    const {username, fullname} = action.payload
    const {infoMap} = draftState
    updateInfo(infoMap, username, {fullname})
  },
  [Tracker2Gen.updateFollows]: (draftState, action) => {
    // Use new follower information to update full names
    const {followers, following} = action.payload
    const all = [...(followers || []), ...(following || [])]
    const {infoMap} = draftState
    all.forEach(({username, fullname}) => updateInfo(infoMap, username, {fullname}))
  },
  [ConfigGen.setAccounts]: (draftState, action) => {
    const {configuredAccounts} = action.payload
    const {infoMap} = draftState
    configuredAccounts.forEach(({username, fullname}) => updateInfo(infoMap, username, {fullname}))
  },
  [TeamBuildingGen.searchResultsLoaded]: (draftState, action) => {
    const {users} = action.payload
    const {infoMap} = draftState
    users.forEach(({serviceMap, prettyName}) => {
      const {keybase} = serviceMap
      if (!keybase) return
      const old = infoMap.get(keybase)
      // only update if unknown
      if (!old || !old.fullname) {
        updateInfo(infoMap, keybase, {fullname: prettyName})
      }
    })
  },
  [TeamsGen.setMembers]: (draftState, action) => {
    const {members} = action.payload
    const {infoMap} = draftState
    members.forEach((v, username) => {
      updateInfo(infoMap, username, {fullname: v.fullName})
    })
  },
  [UsersGen.updateBlockState]: (draftState, action) => {
    const {blocks} = action.payload
    blocks.forEach(({username, chatBlocked, followBlocked}) => {
      // Make blockMap keys normalized usernames.
      draftState.blockMap.set(username.toLowerCase(), {chatBlocked, followBlocked})
    })
  },
})
