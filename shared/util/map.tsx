type MapType<M> = M extends Map<infer K, infer V> ? [K, V] : never

/**
  Get a value from a map, if missing, add the default value and return it
 */
export function mapGetEnsureValue<M extends Map<any, any>>(
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

export function mapEqual<M extends Map<any, any>>(map1: M, map2: M): boolean {
  if (map1 === map2) {
    return true
  }
  const k1 = [...map1.keys()]
  const k2 = [...map2.keys()]
  if (k1.length !== k2.length) {
    return false
  }

  return !k1.some(key => map1.get(key) !== map2.get(key))
}

export function mapFilterByKey<M extends Map<any, any>>(map: M, keys: Set<string>): M {
  return new Map([...map.entries()].filter(([k]) => keys.has(k))) as M
}
