import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/users'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Types from '../constants/types/users'
import * as UsersGen from '../actions/users-gen'

const initialState: Types.State = Constants.makeState()

type Actions =
  | UsersGen.Actions
  | Tracker2Gen.UpdateFollowersPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | ConfigGen.SetAccountsPayload
  | TeamBuildingGen.SearchResultsLoadedPayload

const updateInfo = (map: Map<string, Types.UserInfo>, username: string, info: Partial<Types.UserInfo>) => {
  const next = {
      ...(map.get(username) || null),
      ...info,
    }

    // cleanup data structure so its not full of empty items
  ;['fullname', 'broken', 'bio'].forEach(key => {
    if (!next[key]) {
      delete next[key]
    }
  })

  if (Object.keys(next).length) {
    map.set(username, next)
  } else {
    map.delete(username)
  }
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [UsersGen.resetStore]: () => initialState,
  [UsersGen.updateFullnames]: (draftState, action) => {
    const infoMap = new Map(draftState.infoMap)
    const {usernameToFullname} = action.payload
    for (const [username, fullname] of Object.entries(usernameToFullname)) {
      updateInfo(infoMap, username, {fullname})
    }
    draftState.infoMap = infoMap
  },
  [UsersGen.updateBrokenState]: (draftState, action) => {
    const {newlyBroken, newlyFixed} = action.payload
    const infoMap = new Map(draftState.infoMap)
    newlyFixed.forEach(username => updateInfo(infoMap, username, {broken: false}))
    newlyBroken.forEach(username => updateInfo(infoMap, username, {broken: true}))
    draftState.infoMap = infoMap
  },
  [UsersGen.updateBio]: (draftState, action) => {
    const {username, userCard} = action.payload
    const {bioDecorated} = userCard // using bioDecorated to make links clickable and shruggies whole
    const infoMap = new Map(draftState.infoMap)
    updateInfo(infoMap, username, {bio: bioDecorated})
    draftState.infoMap = infoMap
  },
  [Tracker2Gen.updatedDetails]: (draftState, action) => {
    const {username, fullname} = action.payload
    const infoMap = new Map(draftState.infoMap)
    updateInfo(infoMap, username, {fullname})
    draftState.infoMap = infoMap
  },
  [Tracker2Gen.updateFollowers]: (draftState, action) => {
    const {followers, following} = action.payload
    const all = [...followers, ...following]
    const infoMap = new Map(draftState.infoMap)
    all.forEach(({username, fullname}) => updateInfo(infoMap, username, {fullname}))
    draftState.infoMap = infoMap
  },
  [ConfigGen.setAccounts]: (draftState, action) => {
    const {configuredAccounts} = action.payload
    const infoMap = new Map(draftState.infoMap)
    configuredAccounts.forEach(({username, fullname}) => updateInfo(infoMap, username, {fullname}))
    draftState.infoMap = infoMap
  },
  [TeamBuildingGen.searchResultsLoaded]: (draftState, action) => {
    const {users} = action.payload
    const infoMap = new Map(draftState.infoMap)
    users.forEach(({serviceMap, prettyName}) => {
      const {keybase} = serviceMap
      if (!keybase) return
      const old = infoMap.get(keybase)
      // only update if unknown
      if (!old || !old.fullname) {
        updateInfo(infoMap, keybase, {fullname: prettyName})
      }
    })
    draftState.infoMap = infoMap
  },
})
