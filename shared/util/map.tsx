import type {Draft} from 'immer'

type MapType<M> = M extends Map<infer K, infer V> ? [K, V] : never
type UnwrapDraft<T> = T extends Draft<infer U> ? U : T

/**
  Get a value from a map, if missing, add the default value and return it
  Accepts non-draft defaults even when working with draft maps
 */
export function mapGetEnsureValue<M extends Map<unknown, unknown>>(
  map: M,
  key: MapType<M>[0],
  def: UnwrapDraft<MapType<M>[1]>
): MapType<M>[1] {
  const existing = map.get(key)
  if (existing === undefined) {
    const value = def as MapType<M>[1]
    map.set(key, value)
    return value
  } else {
    return existing
  }
}

export function mapFilterByKey<M extends ReadonlyMap<string, unknown>>(map: M, keys: ReadonlySet<string>): M {
  return new Map([...map.entries()].filter(([k]) => keys.has(k))) as unknown as M
}
