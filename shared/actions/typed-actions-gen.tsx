// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as bots from './bots-gen'
import type * as chat2 from './chat2-gen'
import type * as config from './config-gen'
import type * as enginegen from './engine-gen-gen'
import type * as fs from './fs-gen'
import type * as remote from './remote-gen'
import type * as routetree from './route-tree-gen'
import type * as wallets from './wallets-gen'

export type TypedActions =
  | bots.Actions
  | chat2.Actions
  | config.Actions
  | enginegen.Actions
  | fs.Actions
  | remote.Actions
  | routetree.Actions
  | wallets.Actions

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never
type MapDiscriminatedUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscriminateUnion<T, K, V>
}
export type TypedActionsMap = MapDiscriminatedUnion<TypedActions, 'type'>
