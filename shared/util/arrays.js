/* @flow */

// Like join, but doesn't convert to string at the end
export function intersperse<X> (separator: X, arr: Array<X>): Array<X> {
  return intersperseFn(() => separator, arr)
}

// Like intersperse but takes a function to define the separator
export function intersperseFn<X> (separatorFn: (index: number, x: X) => X, arr: Array<X>): Array<X> {
  if (arr.length === 0) {
    return []
  }

  return arr.slice(1).reduce((acc, x, i) => {
    return acc.concat([separatorFn(i, x), x])
  }, [arr[0]])
}

