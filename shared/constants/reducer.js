// @flow
import type {State as Billing} from '../constants/types/plan-billing'
import type {State as Chat} from '../constants/types/chat'
import type {State as Config} from '../constants/types/config'
import type {State as Dev} from '../constants/types/dev'
import type {State as Devices} from '../constants/types/devices'
import type {State as Entity} from '../constants/types/entities'
import type {State as Engine} from '../constants/types/engine'
import type {State as Favorite} from '../constants/types/favorite'
import type {State as Gregor} from '../constants/types/gregor'
import type {State as Login} from '../constants/types/login'
import type {State as Notification} from '../constants/types/notifications'
import type {State as Pgp} from '../constants/types/pgp'
import type {State as Pinentry} from '../constants/types/pinentry'
import type {State as Profile} from '../constants/types/profile'
import type {State as Push} from '../constants/types/push'
import type {State as RouteTree} from '../constants/route-tree'
import type {State as Settings} from '../constants/settings'
import type {State as Signup} from '../constants/signup'
import type {State as Tracker} from '../constants/types/tracker'
import type {State as UnlockFolders} from '../constants/unlock-folders'
import type {State as Waiting} from '../constants/waiting'

export type TypedState = {
  config: Config,
  chat: Chat,
  dev: Dev,
  devices: Devices,
  entities: Entity,
  engine: Engine,
  favorite: Favorite,
  gregor: Gregor,
  login: Login,
  notifications: Notification,
  pgp: Pgp,
  pinentry: Pinentry,
  planBilling: Billing,
  profile: Profile,
  push: Push,
  routeTree: RouteTree,
  settings: Settings,
  signup: Signup,
  tracker: Tracker,
  unlockFolders: UnlockFolders,
  waiting: Waiting,
}
