// @flow

// Like intersperse but takes a function to define the separator
export function intersperseFn<A, B>(
  separatorFn: (index: number, x: A, a: Array<A>) => B,
  arr: Array<A>
): Array<A | B> {
  if (arr.length === 0) {
    return []
  }

  return arr.slice(1).reduce(
    (acc, x, i, a) => {
      return acc.concat([separatorFn(i, x, a), x])
    },
    [arr[0]]
  )
}
