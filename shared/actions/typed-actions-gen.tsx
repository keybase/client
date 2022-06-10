// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as autoreset from './autoreset-gen'
import type * as bots from './bots-gen'
import type * as chat2 from './chat2-gen'
import type * as config from './config-gen'
import type * as crypto from './crypto-gen'
import type * as deeplinks from './deeplinks-gen'
import type * as dev from './dev-gen'
import type * as devices from './devices-gen'
import type * as enginegen from './engine-gen-gen'
import type * as fs from './fs-gen'
import type * as git from './git-gen'
import type * as gregor from './gregor-gen'
import type * as login from './login-gen'
import type * as notifications from './notifications-gen'
import type * as people from './people-gen'
import type * as pinentry from './pinentry-gen'
import type * as profile from './profile-gen'
import type * as provision from './provision-gen'
import type * as push from './push-gen'
import type * as recoverpassword from './recover-password-gen'
import type * as routetree from './route-tree-gen'
import type * as settings from './settings-gen'
import type * as signup from './signup-gen'
import type * as teambuilding from './team-building-gen'
import type * as teams from './teams-gen'
import type * as tracker2 from './tracker2-gen'
import type * as unlockfolders from './unlock-folders-gen'
import type * as users from './users-gen'
import type * as waiting from './waiting-gen'
import type * as wallets from './wallets-gen'

export type TypedActions =
  | autoreset.Actions
  | bots.Actions
  | chat2.Actions
  | config.Actions
  | crypto.Actions
  | deeplinks.Actions
  | dev.Actions
  | devices.Actions
  | enginegen.Actions
  | fs.Actions
  | git.Actions
  | gregor.Actions
  | login.Actions
  | notifications.Actions
  | people.Actions
  | pinentry.Actions
  | profile.Actions
  | provision.Actions
  | push.Actions
  | recoverpassword.Actions
  | routetree.Actions
  | settings.Actions
  | signup.Actions
  | teambuilding.Actions
  | teams.Actions
  | tracker2.Actions
  | unlockfolders.Actions
  | users.Actions
  | waiting.Actions
  | wallets.Actions

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never
type MapDiscriminatedUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscriminateUnion<T, K, V>
}
export type TypedActionsMap = MapDiscriminatedUnion<TypedActions, 'type'>
