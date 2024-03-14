export function findLast<T>(arr: ReadonlyArray<T>, cb: (t: T) => boolean): T | undefined {
  // this isn't supported on all platforms we use yet, so disabled the typing
  if (arr.findLast) return arr.findLast(cb) // eslint-disable-line
  const last = arr.length - 1
  for (let i = last; i >= 0; --i) {
    if (cb(arr[i]!)) {
      return arr[i]
    }
  }
  return undefined
}
