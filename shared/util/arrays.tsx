import findLastLodash from 'lodash/findLast'

export function findLast<T>(arr: ReadonlyArray<T>, cb: (t: T) => boolean): T | undefined {
  if (arr.findLast) {
    return arr.findLast(cb) // eslint-disable-line
  }
  return findLastLodash(arr, cb)
}
