// @flow
import type {BillingState} from '../constants/plan-billing'
import type {ConfigState} from '../reducers/config'
import type {FavoriteState} from '../constants/favorite'
import type {LoginState} from '../reducers/login'
import type {RootPinentryState} from '../reducers/pinentry'
import type {SignupState} from '../reducers/signup'
import type {State as ChatState} from '../constants/chat'
import type {State as DevState} from '../reducers/dev'
import type {State as DevicesState} from '../constants/devices'
import type {State as EntityState} from '../constants/entities'
import type {State as GregorState} from '../reducers/gregor'
import type {State as NotificationState} from '../constants/notifications'
import type {State as PgpState} from '../reducers/pgp'
import type {State as ProfileState} from '../constants/profile'
import type {State as PushState} from '../constants/push'
import type {State as RouteTreeState} from '../reducers/route-tree'
import type {State as SearchState} from '../reducers/search'
import type {State as SettingsState} from '../constants/settings'
import type {State as TotalTrackerState} from '../reducers/tracker'
import type {State as UnlockFoldersState} from '../reducers/unlock-folders'

export type TypedState = {
  config: ConfigState,
  chat: ChatState,
  dev: DevState,
  devices: DevicesState,
  entities: EntityState,
  favorite: FavoriteState,
  gregor: GregorState,
  login: LoginState,
  notifications: NotificationState,
  pgp: PgpState,
  pinentry: RootPinentryState,
  planBilling: BillingState,
  profile: ProfileState,
  push: PushState,
  routeTree: RouteTreeState,
  search: SearchState,
  settings: SettingsState,
  signup: SignupState,
  tracker: TotalTrackerState,
  unlockFolders: UnlockFoldersState,
}

export type StateLogTransformer = (state: TypedState) => Object

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'

// TODO expand this
export const stateLogTransformer: StateLogTransformer = (state) => {
  const {
    config: {
      username, uid, loggedIn, error, bootstrapTriesRemaining, bootStatus,
    },
    routeTree,
    tracker,
  } = state

  return {
    config: {
      username, uid, loggedIn, error, bootstrapTriesRemaining, bootStatus,
    },
    routeTree,
    tracker,
  }
}
