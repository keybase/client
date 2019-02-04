// @flow
import type {State as Chat2} from '../constants/types/chat2'
import type {State as Config} from '../constants/types/config'
import type {State as Dev} from '../constants/types/dev'
import type {State as Devices} from '../constants/types/devices'
import type {State as Entity} from '../constants/types/entities'
import type {State as Git} from '../constants/types/git'
import type {State as Gregor} from '../constants/types/gregor'
import type {State as FS} from '../constants/types/fs'
import type {State as Login} from '../constants/types/login'
import type {State as Provision} from '../constants/types/provision'
import type {State as Notification} from '../constants/types/notifications'
import type {State as Pinentry} from '../constants/types/pinentry'
import type {State as Profile} from '../constants/types/profile'
import type {State as Tracker2} from '../constants/types/tracker2'
import type {State as Push} from '../constants/types/push'
import type {State as RouteTree} from '../constants/types/route-tree'
import type {State as Settings} from '../constants/types/settings'
import type {State as Signup} from '../constants/types/signup'
import type {State as Teams} from '../constants/types/teams'
import type {State as Tracker} from '../constants/types/tracker'
import type {State as UnlockFolders} from '../constants/types/unlock-folders'
import type {State as Users} from '../constants/types/users'
import type {State as Waiting} from '../constants/types/waiting'
import type {State as People} from '../constants/types/people'
import type {State as Wallets} from '../constants/types/wallets'

export type TypedState = $ReadOnly<{|
  chat2: Chat2,
  config: Config,
  dev: Dev,
  devices: Devices,
  entities: Entity,
  fs: FS,
  git: Git,
  gregor: Gregor,
  login: Login,
  provision: Provision,
  notifications: Notification,
  people: People,
  pinentry: Pinentry,
  profile: Profile,
  tracker2: Tracker2,
  push: Push,
  routeTree: RouteTree,
  settings: Settings,
  signup: Signup,
  teams: Teams,
  tracker: Tracker,
  unlockFolders: UnlockFolders,
  users: Users,
  waiting: Waiting,
  wallets: Wallets,
|}>
