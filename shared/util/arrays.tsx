// Like intersperse but takes a function to define the separator
export function intersperseFn<A, B>(
  separatorFn: (index: number, x: A, a: Array<A>) => B,
  arr: Array<A>
): Array<A | B> {
  if (arr.length === 0) {
    return arr
  }

  const toReturn = new Array(arr.length * 2 - 1)
  toReturn[0] = arr[0]
  for (let i = 1; i < arr.length; i++) {
    toReturn[i * 2 - 1] = separatorFn(i, arr[i], arr)
    toReturn[i * 2] = arr[i]
  }
  return toReturn
}

export function findLast<T>(arr: Array<T>, cb: (t: T) => boolean): T | undefined {
  // @ts-ignore this exists
  if (arr.findLast) return arr.findLast(cb)
  const last = arr.length - 1
  for (let i = last; i >= 0; --i) {
    if (cb(arr[i])) {
      return arr[i]
    }
  }
  return undefined
}
