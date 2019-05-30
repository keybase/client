import {State as Chat2} from '../constants/types/chat2'
import {State as Config} from '../constants/types/config'
import {State as Dev} from '../constants/types/dev'
import {State as Devices} from '../constants/types/devices'
import {State as Entity} from '../constants/types/entities'
import {State as Git} from '../constants/types/git'
import {State as Gregor} from '../constants/types/gregor'
import {State as FS} from '../constants/types/fs'
import {State as Login} from '../constants/types/login'
import {State as Provision} from '../constants/types/provision'
import {State as Notification} from '../constants/types/notifications'
import {State as Pinentry} from '../constants/types/pinentry'
import {State as Profile} from '../constants/types/profile'
import {State as Tracker2} from '../constants/types/tracker2'
import {State as Push} from '../constants/types/push'
import {State as Settings} from '../constants/types/settings'
import {State as Signup} from '../constants/types/signup'
import {State as Teams} from '../constants/types/teams'
import {State as UnlockFolders} from '../constants/types/unlock-folders'
import {State as Users} from '../constants/types/users'
import {State as Waiting} from '../constants/types/waiting'
import {State as People} from '../constants/types/people'
import {State as Wallets} from '../constants/types/wallets'

export type TypedState = {
  readonly chat2: Chat2
  readonly config: Config
  readonly dev: Dev
  readonly devices: Devices
  readonly entities: Entity
  readonly fs: FS
  readonly git: Git
  readonly gregor: Gregor
  readonly login: Login
  readonly provision: Provision
  readonly notifications: Notification
  readonly people: People
  readonly pinentry: Pinentry
  readonly profile: Profile
  readonly tracker2: Tracker2
  readonly push: Push
  readonly settings: Settings
  readonly signup: Signup
  readonly teams: Teams
  readonly unlockFolders: UnlockFolders
  readonly users: Users
  readonly waiting: Waiting
  readonly wallets: Wallets
}
