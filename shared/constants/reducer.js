// @flow
import * as Billing from '../constants/plan-billing'
import * as Chat from '../constants/chat'
import * as Config from '../constants/config'
import * as Dev from '../constants/dev'
import * as Devices from '../constants/devices'
import * as Entity from '../constants/entities'
import * as Favorite from '../constants/favorite'
import * as Gregor from '../constants/gregor'
import * as Login from '../constants/login'
import * as Notification from '../constants/notifications'
import * as Pgp from '../constants/pgp'
import * as Pinentry from '../constants/pinentry'
import * as Profile from '../constants/profile'
import * as Push from '../constants/push'
import * as RouteTree from '../constants/route-tree'
import * as Search from '../constants/search'
import * as Settings from '../constants/settings'
import * as Signup from '../constants/signup'
import * as Tracker from '../constants/tracker'
import * as UnlockFolders from '../constants/unlock-folders'
import {isEmpty, omitBy, isObject, isArray} from 'lodash'

export type TypedState = {
  config: Config.State,
  chat: Chat.State,
  dev: Dev.State,
  devices: Devices.State,
  entities: Entity.State,
  favorite: Favorite.State,
  gregor: Gregor.State,
  login: Login.State,
  notifications: Notification.State,
  pgp: Pgp.State,
  pinentry: Pinentry.State,
  planBilling: Billing.State,
  profile: Profile.State,
  push: Push.State,
  routeTree: RouteTree.State,
  search: Search.State,
  settings: Settings.State,
  signup: Signup.State,
  tracker: Tracker.State,
  unlockFolders: UnlockFolders.State,
}

export type StateLogTransformer = (state: TypedState) => Object

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'

const removeEmpty = (root: any) => {
  if (isArray(root)) {
    return root.map(v => removeEmpty(v))
  } else if (isObject(root)) {
    let ret = {}
    Object.keys(root).forEach(k => {
      ret[k] = removeEmpty(root[k])
    })
    return omitBy(ret, a => !a || isObject(a) && isEmpty(a))
  }
  return root
}

export const stateLogTransformer: StateLogTransformer = (state) => {
  // Never crash us out
  try {
    const transformed = {
      chat: Chat.actionLoggerTransform(state.chat),
      config: Config.actionLoggerTransform(state.config),
      routeTree: RouteTree.actionLoggerTransform(state.routeTree),
      tracker: Tracker.actionLoggerTransform(state.tracker),
    }
    return removeEmpty(transformed)
  } catch (err) {
    debugger
    console.log(`StateLogTransfomer crash: ${err}`)
    return {}
  }
}
