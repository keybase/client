import isEqual from 'lodash/isEqual'

// using immer update and array so we can maximize strict equality
export function updateImmerArray<T, K extends keyof T>(existing: T, propName: K, next: T): void {
  if (!Array.isArray(existing[propName]) || !Array.isArray(next[propName])) {
    throw new Error(`${String(propName)} must be an array.`)
  }
  // if either is empty just adopt the new value
  if (!existing[propName] || !next[propName]) {
    existing[propName] = next[propName]
  } else {
    // iterate and do checks of the sub items
    const existingArr = existing[propName] as Array<unknown>
    const nextArr = next[propName] as Array<unknown>
    existingArr.length = nextArr.length

    for (let i = 0; i < nextArr.length; ++i) {
      const item = nextArr[i]
      if (item && !isEqual(existingArr[i], item)) {
        existingArr[i] = item
      }
    }
  }
}

export function updateImmerVal<T, K extends keyof T>(existing: T, propName: K, next: T): void {
  if (!isEqual(existing[propName], next[propName])) {
    existing[propName] = next[propName]
  }
}
