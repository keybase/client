import isEqual from 'lodash/isEqual'

// using immer update and array so we can maximize strict equality
export function updateImmerMap<K, V>(existing: Map<K, V>, next: Map<K, V>): void {
  // sync keys
  const existingKeys = new Set(existing.keys())

  for (const [key, val] of next) {
    if (!isEqual(existing.get(key), val)) {
      existing.set(key, val)
    }
    existingKeys.delete(key)
  }
  for (const key of existingKeys) {
    existing.delete(key)
  }
}

export function updateImmerVal<T, K extends keyof T>(existing: T, propName: K, next: T): void {
  if (!isEqual(existing[propName], next[propName])) {
    existing[propName] = next[propName]
  }
}

export function updateImmer<T extends {}>(existing: T, next: T): void {
  const props = Object.keys(next) as Array<keyof T>
  const leftovers = new Set<keyof T>(Object.keys(existing) as Array<keyof T>)
  for (const prop of props) {
    leftovers.delete(prop)
    if (!isEqual(existing[prop], next[prop])) {
      existing[prop] = next[prop]
    }
  }
  for (const prop of leftovers) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete existing[prop]
  }
}
