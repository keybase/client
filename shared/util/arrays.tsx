export function findLast<T>(arr: Array<T>, cb: (t: T) => boolean): T | undefined {
  if (arr.findLast) return arr.findLast(cb) // eslint-disable-line
  const last = arr.length - 1
  for (let i = last; i >= 0; --i) {
    if (cb(arr[i]!)) {
      return arr[i]
    }
  }
  return undefined
}
