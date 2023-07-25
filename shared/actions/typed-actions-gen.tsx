// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as chat2 from './chat2-gen'
import type * as enginegen from './engine-gen-gen'
import type * as remote from './remote-gen'

export type TypedActions = chat2.Actions | enginegen.Actions | remote.Actions

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never
type MapDiscriminatedUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscriminateUnion<T, K, V>
}
export type TypedActionsMap = MapDiscriminatedUnion<TypedActions, 'type'>
