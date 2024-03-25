type MapType<M> = M extends Map<infer K, infer V> ? [K, V] : never

/**
  Get a value from a map, if missing, add the default value and return it
 */
export function mapGetEnsureValue<M extends Map<unknown, unknown>>(
  map: M,
  key: MapType<M>[0],
  def: MapType<M>[1]
): MapType<M>[1] {
  const existing = map.get(key)
  if (existing === undefined) {
    map.set(key, def)
    return def
  } else {
    return existing
  }
}

export function mapFilterByKey<M extends ReadonlyMap<string, unknown>>(map: M, keys: ReadonlySet<string>): M {
  return new Map([...map.entries()].filter(([k]) => keys.has(k))) as unknown as M
}
